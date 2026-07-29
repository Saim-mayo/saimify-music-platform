import requests
from PIL import Image
from io import BytesIO
url = 'https://ik.imagekit.io/lx583mdi8/ytmusic-clone/avatars/1785326829608_image_4bb8ecenew_rr117MRCa.png'
resp = requests.get(url)
with open('avatar_inspect.png', 'wb') as f:
    f.write(resp.content)
img = Image.open(BytesIO(resp.content))
print('format', img.format)
print('mode', img.mode)
print('size', img.size)
print('info', img.info)
if img.mode == 'RGBA':
    alpha = img.split()[-1]
    print('alpha extrema', alpha.getextrema())
    pixels = img.load()
    w, h = img.size
    corners = [pixels[0,0], pixels[0,h-1], pixels[w-1,0], pixels[w-1,h-1]]
    center = pixels[w//2, h//2]
    print('corner pixels', corners)
    print('center pixel', center)
