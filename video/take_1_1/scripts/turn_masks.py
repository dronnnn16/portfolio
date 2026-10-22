"""Person cutouts (RGBA) for the TURN beat, so the 'kyun?' text can sit behind the subject."""
import glob, os, sys
from PIL import Image
from rembg import new_session, remove

sess = new_session("u2net_human_seg")
for p in sorted(glob.glob("data/turn_src/*.png")):
    out = os.path.join("public/turn", os.path.basename(p))
    remove(Image.open(p), session=sess, post_process_mask=True).save(out, optimize=False, compress_level=3)
    print(out, flush=True)
