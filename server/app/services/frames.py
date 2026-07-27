from pathlib import Path
import httpx, hashlib

async def download_image(url: str, dest: str) -> str:
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(url)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)
    return dest

def upscale_image(src: str, dest: str, target_size: tuple = (1200, 1800)) -> str:
    from PIL import Image
    img = Image.open(src).convert("RGB")
    img = img.resize(target_size, Image.LANCZOS)
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=95)
    return dest

def compose_print_frame(
    image_path: str,
    output_path: str,
    frame_path: str | None = None,
    target_size: tuple = (1200, 1800),
    watermark_text: str | None = None,
    watermark_position: str = 'bottom-right',
    watermark_opacity: float = 0.5,
    logo_path: str | None = None,
) -> str:
    from PIL import Image, ImageDraw, ImageFont
    img = Image.open(image_path).convert("RGBA")
    img = img.resize(target_size, Image.LANCZOS)

    if frame_path and Path(frame_path).exists():
        frame = Image.open(frame_path).convert("RGBA")
        frame = frame.resize(target_size, Image.LANCZOS)
        img = Image.alpha_composite(img, frame)

    # Logo branding overlay
    if logo_path and Path(logo_path).exists():
        try:
            logo = Image.open(logo_path).convert("RGBA")
            logo_width = int(target_size[0] * 0.25)
            logo_height = int(logo.height * (logo_width / logo.width))
            logo = logo.resize((logo_width, logo_height), Image.LANCZOS)
            img.paste(logo, (target_size[0] - logo_width - 30, 30), logo)
        except Exception as e:
            print(f"[branding] Logo error: {e}")

    # Watermark text overlay
    if watermark_text:
        try:
            txt_layer = Image.new("RGBA", target_size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(txt_layer)
            font_size = int(target_size[1] * 0.025)
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except IOError:
                font = ImageFont.load_default()

            text_bbox = draw.textbbox((0, 0), watermark_text, font=font)
            txt_w = text_bbox[2] - text_bbox[0]
            txt_h = text_bbox[3] - text_bbox[1]

            margin = 30
            if watermark_position == 'top-left':
                pos = (margin, margin)
            elif watermark_position == 'top-right':
                pos = (target_size[0] - txt_w - margin, margin)
            elif watermark_position == 'bottom-left':
                pos = (margin, target_size[1] - txt_h - margin)
            else: # bottom-right
                pos = (target_size[0] - txt_w - margin, target_size[1] - txt_h - margin)

            alpha = int(255 * clamp(watermark_opacity, 0.1, 1.0))
            draw.text(pos, watermark_text, fill=(255, 255, 255, alpha), font=font)
            img = Image.alpha_composite(img, txt_layer)
        except Exception as e:
            print(f"[branding] Watermark error: {e}")

    final_rgb = img.convert("RGB")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    final_rgb.save(output_path, "JPEG", quality=95)
    return output_path

def clamp(val, min_val, max_val):
    return max(min_val, min(val, max_val))

def create_photo_collage(
    image_paths: list[str],
    output_path: str,
    target_size: tuple = (1200, 1800),
    spacing: int = 20
) -> str:
    from PIL import Image
    if not image_paths:
        raise ValueError("No images provided for collage")
    if len(image_paths) == 1:
        return upscale_image(image_paths[0], output_path, target_size)

    canvas = Image.new("RGB", target_size, (15, 15, 25))
    count = len(image_paths)

    if count == 2:
        # Vertical 2-strip
        cell_w = target_size[0] - (2 * spacing)
        cell_h = (target_size[1] - (3 * spacing)) // 2
        for idx, path in enumerate(image_paths[:2]):
            im = Image.open(path).convert("RGB").resize((cell_w, cell_h), Image.LANCZOS)
            y = spacing + idx * (cell_h + spacing)
            canvas.paste(im, (spacing, y))
    elif count == 3:
        # 1 top big, 2 bottom small
        cell_w1 = target_size[0] - (2 * spacing)
        cell_h1 = (target_size[1] - (3 * spacing)) * 3 // 5
        im1 = Image.open(image_paths[0]).convert("RGB").resize((cell_w1, cell_h1), Image.LANCZOS)
        canvas.paste(im1, (spacing, spacing))

        cell_w2 = (target_size[0] - (3 * spacing)) // 2
        cell_h2 = (target_size[1] - (3 * spacing)) - cell_h1
        y2 = spacing * 2 + cell_h1
        for idx, path in enumerate(image_paths[1:3]):
            im = Image.open(path).convert("RGB").resize((cell_w2, cell_h2), Image.LANCZOS)
            x = spacing + idx * (cell_w2 + spacing)
            canvas.paste(im, (x, y2))
    else:
        # 2x2 grid
        cell_w = (target_size[0] - (3 * spacing)) // 2
        cell_h = (target_size[1] - (3 * spacing)) // 2
        for idx, path in enumerate(image_paths[:4]):
            im = Image.open(path).convert("RGB").resize((cell_w, cell_h), Image.LANCZOS)
            row = idx // 2
            col = idx % 2
            x = spacing + col * (cell_w + spacing)
            y = spacing + row * (cell_h + spacing)
            canvas.paste(im, (x, y))

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "JPEG", quality=95)
    return output_path

def check_faces(image_path: str) -> int:
    try:
        from PIL import Image
        import pathlib
        img_path = pathlib.Path(image_path)
        try:
            import cv2
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            img = cv2.imread(image_path)
            if img is None:
                return 0
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            return len(faces)
        except ImportError:
            pass
    except Exception:
        pass
    return 0


def detect_and_crop_user_faces(image_path: str, output_dir: str) -> list[dict]:
    """
    Detects faces in image_path using OpenCV, sorts them from left to right,
    crops each face with padding, and saves as user1.jpg, user2.jpg, user3.jpg...
    Returns a list of dicts: [{"name": "user1", "path": ".../user1.jpg"}, ...]
    """
    try:
        import cv2
        from pathlib import Path

        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        img = cv2.imread(image_path)
        if img is None:
            return []

        img_h, img_w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(50, 50)
        )

        if len(faces) == 0:
            return []

        # Sort faces left to right by x-coordinate
        sorted_faces = sorted(faces, key=lambda f: f[0])

        cropped_users = []
        for idx, (x, y, w, h) in enumerate(sorted_faces, start=1):
            user_name = f"user{idx}"
            
            # Add generous margin padding around face
            pad_w = int(w * 0.35)
            pad_h = int(h * 0.40)
            
            x1 = max(0, x - pad_w)
            y1 = max(0, y - pad_h)
            x2 = min(img_w, x + w + pad_w)
            y2 = min(img_h, y + h + pad_h)

            face_crop = img[y1:y2, x1:x2]
            crop_filename = f"{user_name}.jpg"
            crop_filepath = str(out_path / crop_filename)

            cv2.imwrite(crop_filepath, face_crop)
            cropped_users.append({
                "name": user_name,
                "path": crop_filepath,
                "box": [int(x), int(y), int(w), int(h)],
                "crop_bounds": [int(x1), int(y1), int(x2), int(y2)]
            })
            print(f"[face_crop] Saved face crop for {user_name} (x={x}) to {crop_filepath}")

        return cropped_users
    except Exception as e:
        print(f"[face_crop] Face cropping error: {e}")
        return []
