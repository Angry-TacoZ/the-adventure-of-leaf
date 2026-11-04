"""Run with Blender --background --disable-autoexec --python this_file -- SOURCE_ROOT DESTINATION.
Exports selected low-cost variants from the user-supplied Poly Haven archives.
"""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source_root,destination=map(Path,args[:2])
destination.mkdir(parents=True,exist_ok=True)
variants={'dandelion_01':'dandelion_01_a_LOD1','celandine_01':'celandine_01_c_LOD1','fern_02':'fern_02_b','searsia_lucida':'searsia_lucida_f_LOD2','moss_01':'moss_01_a_LOD1','nettle_plant':'nettle_plant_tall_a_LOD1','grass_medium_01':'grass_medium_01_large_a_LOD2'}

def normalize_card_materials(obj):
 # The source's custom translucent shader groups are not glTF material inputs.
 # Export explicit Principled color/opacity links, preserving opaque bark materials.
 for material in set(slot.material for slot in obj.material_slots if slot.material):
  nodes=material.node_tree.nodes
  images=[node.image for node in nodes if node.type=='TEX_IMAGE' and node.image]
  def image_with(token):
   return next((image for image in images if token in image.name),None)
  diffuse=image_with('_diff')
  if not diffuse:continue
  alpha=image_with('_alpha')
  rough=image_with('_rough')
  normal=image_with('_nor_gl')
  nodes.clear();links=material.node_tree.links
  shader=nodes.new('ShaderNodeBsdfPrincipled')
  output=nodes.new('ShaderNodeOutputMaterial')
  links.new(shader.outputs['BSDF'],output.inputs['Surface'])
  def connect(image,socket):
   if not image:return
   node=nodes.new('ShaderNodeTexImage');node.image=image
   links.new(node.outputs['Color'],shader.inputs[socket])
  connect(diffuse,'Base Color');connect(alpha,'Alpha');connect(rough,'Roughness')
  if normal:
   tex=nodes.new('ShaderNodeTexImage');tex.image=normal
   mapping=nodes.new('ShaderNodeNormalMap')
   links.new(tex.outputs['Color'],mapping.inputs['Color'])
   links.new(mapping.outputs['Normal'],shader.inputs['Normal'])
  if alpha:material.surface_render_method='DITHERED'

for name,object_name in variants.items():
 if len(args)>2 and name not in args[2].split(','):continue
 source=source_root/name/f'{name}_1k.blend'
 bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
 for image in bpy.data.images:
  filename=Path(image.filepath.replace('\\','/')).name
  if filename and (source.parent/'textures'/filename).exists():image.filepath=str(source.parent/'textures'/filename)
 bpy.ops.object.select_all(action='DESELECT')
 obj=bpy.data.objects[object_name]
 if name in ('dandelion_01','celandine_01','searsia_lucida'):normalize_card_materials(obj)
 if obj.name not in bpy.context.scene.collection.objects:bpy.context.scene.collection.objects.link(obj)
 bpy.context.view_layer.update()
 if name=='moss_01':
  # Build a small carpet from true-sized 2-3 cm moss strands, not giant leaves.
  copies=[obj]
  for j in range(1,36):
   clone=obj.copy();clone.data=obj.data;bpy.context.scene.collection.objects.link(clone);copies.append(clone)
  for j,item in enumerate(copies):
   item.location=Vector(((j%6)*0.023,(j//6)*0.023,0));item.rotation_euler.z=j*2.399;item.hide_set(False);item.select_set(True)
  bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
 obj.hide_set(False);obj.hide_viewport=False;obj.hide_render=False;obj.select_set(True);bpy.context.view_layer.objects.active=obj
 points=[obj.matrix_world@Vector(corner) for corner in obj.bound_box]
 obj.location-=Vector(((min(v.x for v in points)+max(v.x for v in points))/2,(min(v.y for v in points)+max(v.y for v in points))/2,min(v.z for v in points)))
 bpy.context.view_layer.update()
 bpy.ops.export_scene.gltf(filepath=str(destination/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_image_format='AUTO',export_cameras=False,export_lights=False)
 print('PLANT_EXPORT',json.dumps({'asset':name,'variant':object_name,'vertices':len(obj.data.vertices),'file':str(destination/f'{name}.glb')}))
