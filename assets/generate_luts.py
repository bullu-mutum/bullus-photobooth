
from PIL import Image
import math

SIZE = 64
IMG_WIDTH = SIZE * 8
IMG_HEIGHT = SIZE * 8

def apply_fuji(r, g, b):
    # Base adjustments
    # Desaturate
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    sat = 0.85
    r = luma + (r - luma) * sat
    g = luma + (g - luma) * sat
    b = luma + (b - luma) * sat
    
    # Lifted blacks (fade)
    black_lift = 0.04
    r = r * (1 - black_lift) + black_lift
    g = g * (1 - black_lift) + black_lift
    b = b * (1 - black_lift) + black_lift
    
    # Cyan/Green shadows
    shadow_mask = 1.0 - luma
    r -= 0.04 * shadow_mask
    g += 0.02 * shadow_mask
    b += 0.03 * shadow_mask
    
    # Softer highlights
    high_mask = max(0, luma - 0.5) * 2.0
    r -= 0.03 * high_mask
    b += 0.02 * high_mask
    
    return max(0, min(1, r)), max(0, min(1, g)), max(0, min(1, b))

def apply_bw(r, g, b):
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    # Contrast curve
    val = luma
    val = val * 1.1 - 0.05
    val = max(0, min(1, val))
    # Soft S-curve
    val = val * val * (3 - 2 * val)
    return val, val, val

def create_lut(filename, func):
    img = Image.new('RGB', (IMG_WIDTH, IMG_HEIGHT))
    pixels = img.load()
    
    for b in range(SIZE):
        bx = b % 8
        by = b // 8
        for g in range(SIZE):
            for r in range(SIZE):
                x = bx * SIZE + r
                y = by * SIZE + g
                
                rn = r / (SIZE - 1.0)
                gn = g / (SIZE - 1.0)
                bn = b / (SIZE - 1.0)
                
                rn, gn, bn = func(rn, gn, bn)
                
                pixels[x, y] = (int(rn * 255), int(gn * 255), int(bn * 255))
                
    img.save(filename)

create_lut('fuji_c200.png', apply_fuji)
create_lut('bw_tri_x.png', apply_bw)
