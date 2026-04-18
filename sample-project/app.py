import gradio as gr


def detect_fake_job(description):
    normalized_text = (description or "").strip().lower()

    if not normalized_text:
        return {
            "result": "Unknown",
            "reason": "Empty description",
        }

    if "fee" in normalized_text:
        return {
            "result": "Fake Job",
            "reason": "Asking for money",
        }

    return {
        "result": "Real Job",
        "reason": "No suspicious pattern",
    }


demo = gr.Interface(
    fn=detect_fake_job,
    inputs=gr.Textbox(lines=10, label="Paste Job Description"),
    outputs="json",
)

demo.launch(server_name="0.0.0.0", server_port=7860)
