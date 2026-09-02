from PIL import Image, ImageDraw

NAVY = (13, 43, 94, 255)
GREEN = (0, 168, 107, 255)


def make_mark(size: int) -> Image.Image:
  img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
  draw = ImageDraw.Draw(img)
  cx = cy = size / 2

  def ring(r_outer: float, r_inner: float, color: tuple) -> None:
    bbox_o = [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer]
    draw.ellipse(bbox_o, fill=color)
    if r_inner > 0:
      bbox_i = [cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner]
      draw.ellipse(bbox_i, fill=(0, 0, 0, 0))

  r = size * 0.46
  ring(r, r * 0.82, NAVY)
  ring(r * 0.68, r * 0.58, NAVY)
  ring(r * 0.42, r * 0.34, NAVY)
  rc = r * 0.18
  draw.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=GREEN)
  return img


out_dir = r'c:\Users\Usuário\Documents\Dev\FOCOMEI\frontend\assets'
for name, size in [('favicon.png', 64), ('brand-icon.png', 256), ('favicon-transparent.png', 128)]:
  path = f'{out_dir}\\{name}'
  make_mark(size).save(path, 'PNG')
  im = Image.open(path)
  print(name, im.mode, im.size, 'alpha', im.getchannel('A').getextrema())
