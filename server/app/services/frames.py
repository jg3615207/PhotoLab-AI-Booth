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
) -> str:
    from PIL import Image
    img = Image.open(image_path).convert("RGB")
    img = img.resize(target_size, Image.LANCZOS)

    if frame_path and Path(frame_path).exists():
        frame = Image.open(frame_path).convert("RGBA")
        frame = frame.resize(target_size, Image.LANCZOS)
        img = Image.alpha_composite(img.convert("RGBA"), frame).convert("RGB")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "JPEG", quality=95)
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
                "path": crop_filepath
            })
            print(f"[face_crop] Saved face crop for {user_name} (x={x}) to {crop_filepath}")

        return cropped_users
    except Exception as e:
        print(f"[face_crop] Face cropping error: {e}")
        return []
