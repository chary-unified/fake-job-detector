---
title: Sample Project
emoji: 🌖
colorFrom: indigo
colorTo: indigo
sdk: gradio
sdk_version: 6.12.0
app_file: app.py
pinned: false
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference

## API endpoint

After deploy, call this endpoint:

https://your-username-your-space.hf.space/run/predict

Request body:

{
	"data": ["job description text"]
}
