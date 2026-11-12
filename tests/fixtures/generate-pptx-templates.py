# Makes the PowerPoint templates the template tests use (P30.7): python-pptx 1.x, run from tests/fixtures.
# A plain 4:3 template with a blue "Schoollogo" on the master and two example slides;
# -notes also has a notes master; the .potx is the same package as a template.
from pptx import Presentation
from pptx.util import Inches
from pptx.dml.color import RGBColor
import zipfile, shutil
p = Presentation()
master = p.slide_master
tmp = p.slides.add_slide(p.slide_layouts[6])
shape = tmp.shapes.add_shape(1, Inches(8.5), Inches(0.2), Inches(1.2), Inches(0.5))  # the school "logo"
shape.name = "Schoollogo"
shape.fill.solid(); shape.fill.fore_color.rgb = RGBColor(0x00, 0x33, 0x99)
master.shapes._spTree.append(shape._element)
rId = p.slides._sldIdLst[0].rId
p.part.drop_rel(rId); p.slides._sldIdLst.remove(p.slides._sldIdLst[0])
s = p.slides.add_slide(p.slide_layouts[0]); s.shapes.title.text = "Voorbeelddia van de school"
s2 = p.slides.add_slide(p.slide_layouts[1]); s2.shapes.title.text = "Nog een voorbeeld"
p.save("template-school.pptx")
s.notes_slide.notes_text_frame.text = "notities"
p.save("template-school-notes.pptx")
# a .potx: same package, template main content type
zin = zipfile.ZipFile("template-school.pptx"); zout = zipfile.ZipFile("template-school.potx", "w", zipfile.ZIP_DEFLATED)
for i in zin.infolist():
    data = zin.read(i.filename)
    if i.filename == "[Content_Types].xml":
        data = data.replace(b"presentationml.presentation.main+xml", b"presentationml.template.main+xml")
    zout.writestr(i, data)
zout.close()
