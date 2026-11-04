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
for name,object_name in variants.items():
 if len(args)>2 and name not in args[2].split(','):continue
 source=source_root/name/f'{name}_1k.blend'
 bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
 for image in bpy.data.images:
  filename=Path(image.filepath.replace('\\','/')).name
  if filename and (source.parent/'textures'/filename).exists():image.filepath=str(source.parent/'textures'/filename)
 bpy.ops.object.select_all(action='DESELECT')
 obj=bpy.data.objects[object_name]
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
