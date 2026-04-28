# Medical AI Prompt Library (Vibe-Med)

"Build an 3D UNet to segment coronary arteries from my DICOM files, benchmark it against the ASOCA leaderboards, and deploy a Gradio dashboard with a slider to view the 3D slices." Agent Action: Trains MONAI model -> Computes Dice Score -> Launches Gradio UI with a slice-by-slice viewer.

"Train a SwinUNETR transformer to segment brain tumors from multi-modal MRI scans, and deploy a Gradio interface that compares the prediction against the ground truth." Agent Action: Loads BraTS dataset -> Trains SwinUNETR -> Launches Gradio side-by-side comparison UI.

"Classify these histopathology slides for breast cancer, report the F1-score, and build a Gradio gallery showing the most uncertain cases for human review." Agent Action: Fine-tunes a Vision Transformer -> Computes Metrics -> Launches Gradio 'Uncertainty Gallery' UI.

"Analyze lung nodule detection in these NIfTI volumes, optimize the detection threshold with Optuna, and deploy a Gradio 'Nodule Navigator' for slice-by-slice inspection." Agent Action: Runs 3D Detection -> Optuna Tuning -> Launches Gradio Nodule Explorer UI.

"Benchmark my coronary segmentation model against the latest Medical Decathlon results and show a Gradio heatmap of where the model is failing." Agent Action: Evaluates model -> Comparison vs SOTA -> Launches Gradio 'Error Heatmap' UI.

"Deploy my trained respiratory infection classifier to Hugging Face Spaces and create a Gradio interface for clinicians to upload chest X-rays." Agent Action: Saves Model -> Creates HF Space -> Pushes app.py and requirements.txt.
