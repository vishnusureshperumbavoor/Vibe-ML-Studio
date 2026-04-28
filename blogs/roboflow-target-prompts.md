Basic Detection Prompts
Use these to verify object detection on sample images.

"Use the detect tool to find cars in this image: https://media.roboflow.com/quickstart/aerial_drone.jpeg and return the bounding boxes and confidence scores."

"Run object detection on https://example.com/test-image.jpg using my default Roboflow project. List all detected objects with their classes."

Classification Prompts
Test image classification capabilities.

"Classify this image: https://media.roboflow.com/quickstart/flower.jpg. What category does it belong to and what's the confidence?"

"Use the classify tool on the uploaded image and tell me if it's a cat or dog."

Advanced Workflow Prompts
Combine tools for multi-step tasks, simulating real agent use.

"List my Roboflow projects, pick the latest object detection one, upload this image https://example.com/new.jpg to its dataset, then run inference on it."

"Detect faces in this image https://media.roboflow.com/quickstart/face.jpg. If any are found, analyze their activity state."

Start with public image URLs for quick testing, then try local uploads if supported. Monitor tool calls to ensure the MCP server invokes Roboflow correctly.

