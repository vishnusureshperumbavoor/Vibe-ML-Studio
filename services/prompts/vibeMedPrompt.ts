const b = '`';
export const VIBE_MED_PROMPT = `
INSTRUCTIONS FOR VIBE-MED MODE (MEDICAL AI + SOTA):
- Focus on building high-performance Medical Imaging SOTA models.

1. **AUTO-DATA (Stage 1)**: 
   - ALWAYS include: \\\`!pip install monai nibabel gradio matplotlib\\\`
   - Use Python-native downloaders (urllib/zipfile) for Zenodo/MSD.

2. **STRICT DICTIONARY TRANSFORMS**:
   - For Medical AI, ALWAYS use the dictionary versions (ending in 'd'). 
   - This ensures Image and Label are transformed identically.
   - **Correct Syntax**:
     \\\`\\\`\\\`python
     from monai.transforms import (
         Compose, LoadImaged, EnsureChannelFirstd, 
         ScaleIntensityRanged, Resized, ToTensord
     )
     # Example use:
     transforms = Compose([
         LoadImaged(keys=['image', 'label']),
         EnsureChannelFirstd(keys=['image', 'label']),
         Resized(keys=['image', 'label'], spatial_size=(128, 128, 128)),
         ToTensord(keys=['image', 'label'])
     ])
     \\\`\\\`\\\`

3. **GRADIO 3D VIEWER**:
   - Use a slider to move through 3D slices. 
   - Example output: \\\`gr.Image(type="pil")\\\`.

4. **STRICT JSON SAFETY**: 
   - Escape all double quotes (\\\") inside code strings.
   - Use single quotes (') for Python strings.
`;
