import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('art',Path(__file__).with_name('generate-scripture-art.py'))
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
class SvgBoundary(unittest.TestCase):
 def svg(self,paint='#e8b86d',extra=''):
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">'+''.join('<path d="M0 0L2 2" fill="'+paint+'"/>' for _ in range(36))+extra+'</svg>'
 def test_local_drawing(self):
  self.assertEqual(art.sanitize(self.svg())[1],37)
 def test_external_paints(self):
  for value in ['URL(ftp:example.org/art.svg#x)',r'URL(\68 ttps:example.org/art.svg#x)','url(https://evil.test/x)','url(//evil.test/x)','var(--paint)','URL(#local)']:
   with self.subTest(value=value),self.assertRaises(ValueError):art.sanitize(self.svg(value))
 def test_active_content(self):
  for extra in ['<script>alert(1)</script>','<image href="https://evil.test"/>','<foreignObject/>','<animate attributeName="fill"/>','<rect onload="alert(1)"/>']:
   with self.subTest(extra=extra),self.assertRaises(ValueError):art.sanitize(self.svg(extra=extra))
 def test_comments_are_inert(self):
  result,_=art.sanitize(self.svg(extra='<!-- drawing notes -->'))
  self.assertNotIn('drawing notes',result)
 def test_duplicate_ids(self):
  with self.assertRaises(ValueError):art.sanitize(self.svg(extra='<g id="a"/><g id="a"/>'))
if __name__=='__main__':unittest.main()
