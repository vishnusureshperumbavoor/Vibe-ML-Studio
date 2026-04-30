import asyncio
import re
from datasets import load_dataset
from inference import native_manager

class BenchmarkRunner:
    def __init__(self):
        self.status = {"step": "idle", "progress": 0, "total": 0, "current_task": ""}

    def _extract_gsm8k_answer(self, answer_str: str) -> str:
        # GSM8K answers usually end with '#### <number>'
        if "####" in answer_str:
            return answer_str.split("####")[-1].strip()
        # Fallback regex for numbers if missing
        numbers = re.findall(r"[-+]?\d*\.\d+|\d+", answer_str)
        if numbers:
            return numbers[-1]
        return ""

    def run_gsm8k(self, model_filename: str, lora_slug: str, num_questions: int = 50):
        try:
            dataset = load_dataset("gsm8k", "main", split="test")
            # Select random subset
            subset = dataset.shuffle(seed=42).select(range(min(num_questions, len(dataset))))
        except Exception as e:
            self.status = {"step": "error", "progress": 0, "total": 0, "current_task": str(e)}
            return {"error": f"Failed to load dataset: {str(e)}"}

        correct = 0
        total = len(subset)
        results = []
        self.status = {"step": "running", "progress": 0, "total": total, "current_task": "Starting GSM8K Evaluation..."}

        for i, item in enumerate(subset):
            task_msg = f"Evaluating GSM8K question {i+1}/{total}..."
            print(f"\\n[Benchmark] {task_msg}")
            self.status = {"step": "running", "progress": i, "total": total, "current_task": task_msg}
            question = item['question']
            expected_full_answer = item['answer']
            expected_answer = self._extract_gsm8k_answer(expected_full_answer)

            prompt = f"{question}\nPlease reason step by step, and put your final answer after '#### '."
            messages = [{"role": "user", "content": prompt}]
            
            try:
                # Use synchronous chat method
                response = native_manager.chat(model_filename, lora_slug, messages)
                predicted_answer = self._extract_gsm8k_answer(response)
                is_correct = (predicted_answer == expected_answer)
            except Exception as e:
                response = f"Error: {str(e)}"
                predicted_answer = ""
                is_correct = False

            if is_correct:
                correct += 1

            results.append({
                "question": question,
                "expected": expected_answer,
                "predicted": predicted_answer,
                "is_correct": is_correct
            })

        accuracy = correct / total if total > 0 else 0
        self.status = {"step": "idle", "progress": 0, "total": 0, "current_task": ""}
        return {
            "dataset": "gsm8k",
            "accuracy": accuracy,
            "correct": correct,
            "total": total,
            "details": results
        }

    def run_mmlu(self, model_filename: str, lora_slug: str, num_questions: int = 50):
        try:
            dataset = load_dataset("cais/mmlu", "all", split="test")
            subset = dataset.shuffle(seed=42).select(range(min(num_questions, len(dataset))))
        except Exception as e:
            self.status = {"step": "error", "progress": 0, "total": 0, "current_task": str(e)}
            return {"error": f"Failed to load dataset: {str(e)}"}

        correct = 0
        total = len(subset)
        results = []
        self.status = {"step": "running", "progress": 0, "total": total, "current_task": "Starting MMLU Evaluation..."}

        choices_map = {0: "A", 1: "B", 2: "C", 3: "D"}

        for i, item in enumerate(subset):
            task_msg = f"Evaluating MMLU question {i+1}/{total}..."
            print(f"\\n[Benchmark] {task_msg}")
            self.status = {"step": "running", "progress": i, "total": total, "current_task": task_msg}
            question = item['question']
            choices = item['choices']
            answer_idx = item['answer']
            expected_answer = choices_map.get(answer_idx, "")

            prompt = f"Question: {question}\n"
            for i, choice in enumerate(choices):
                prompt += f"{choices_map[i]}. {choice}\n"
            prompt += "Answer with only the letter (A, B, C, or D)."

            messages = [{"role": "user", "content": prompt}]
            
            try:
                response = native_manager.chat(model_filename, lora_slug, messages)
                # Find the first A, B, C, or D in the response
                match = re.search(r'\b([A-D])\b', response.strip().upper())
                predicted_answer = match.group(1) if match else ""
                is_correct = (predicted_answer == expected_answer)
            except Exception as e:
                response = f"Error: {str(e)}"
                predicted_answer = ""
                is_correct = False

            if is_correct:
                correct += 1
                
            results.append({
                "question": question,
                "expected": expected_answer,
                "predicted": predicted_answer,
                "is_correct": is_correct
            })

        accuracy = correct / total if total > 0 else 0
        self.status = {"step": "idle", "progress": 0, "total": 0, "current_task": ""}
        return {
            "dataset": "mmlu",
            "accuracy": accuracy,
            "correct": correct,
            "total": total,
            "details": results
        }

runner = BenchmarkRunner()
