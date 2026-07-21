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
