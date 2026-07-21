import httpx

api_key = 'ef39127499964ff48a68690afd80f268'
base = 'https://www.runninghub.ai'

# Upload style reference images and get their file names
# You need to have the style ref images locally
refs = {
    'ghibli-dream': '',
    'oil-portrait': '',
    'cyberpunk-neon': '',
}

for style, path in refs.items():
    if not path:
        print(f'SKIP {style}: no path set')
        continue
    with open(path, 'rb') as f:
        r = httpx.post(f'{base}/task/openapi/upload', data={'apiKey': api_key}, files={'file': ('ref.jpg', f, 'image/jpeg')})
        d = r.json()
        print(f'{style}: {d.get("data",{}).get("fileName","FAIL")}')
