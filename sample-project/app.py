import gradio as gr


def detect_fake_job(description):
    # Temporary logic (we'll upgrade later)
    if "pay fee" in description.lower() or "registration fee" in description.lower():
        return "⚠️ Fake Job Detected (Asking for money)"
    else:
        return "✅ Looks like a Legit Job"


demo = gr.Interface(
    fn=detect_fake_job,
    inputs=gr.Textbox(lines=10, label="Paste Job Description"),
    outputs="text",
)

demo.launch(server_name="0.0.0.0", server_port=7860)
