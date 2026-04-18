# GuardJob Vercel Frontend

This folder contains a frontend-only app for Vercel.
It calls your Hugging Face Space through a server-side API route to avoid browser CORS issues.

## 1) Configure backend URL

Copy `.env.example` to `.env.local` and set your Space URL:

HF_SPACE_URL=https://your-username-your-space.hf.space

The API route will call:

https://your-username-your-space.hf.space/run/predict

## 2) Run frontend only (local)

1. `cd frontend-vercel`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000`

## 3) Deploy to Vercel

1. Import this `frontend-vercel` folder as a Vercel project
2. Add environment variable `HF_SPACE_URL` in Vercel settings
3. Deploy

## 4) API contract used

Request body sent to Hugging Face:

{
  "data": ["job description text"]
}

This matches Gradio `/run/predict` requirements.
