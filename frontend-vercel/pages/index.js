import { useState } from "react";

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);

  async function checkJob(input) {
    const response = await fetch("/api/check-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: input }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Prediction failed");
    }

    return payload.prediction;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!description.trim()) {
      setError("Please enter a job description");
      return;
    }

    setLoading(true);
    setError("");
    setPrediction(null);

    try {
      const result = await checkJob(description);
      setPrediction(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isFake = prediction?.result === "Fake Job";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>GuardJob Frontend</h1>
        <p style={styles.subtitle}>Vercel UI connected to Hugging Face backend via API route</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Paste a job description"
            rows={8}
            style={styles.textarea}
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Analyzing..." : "Analyze Job"}
          </button>
        </form>

        {error ? <p style={styles.error}>{error}</p> : null}

        {prediction ? (
          <div
            style={{
              ...styles.resultBox,
              borderColor: isFake ? "#ef4444" : "#22c55e",
              backgroundColor: isFake ? "#fef2f2" : "#f0fdf4",
            }}
          >
            <h2 style={styles.resultTitle}>{prediction.result}</h2>
            <p style={styles.resultReason}>{prediction.reason}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(145deg, #f8fafc 0%, #e0f2fe 45%, #dcfce7 100%)",
    padding: "24px",
    fontFamily: "Segoe UI, Helvetica, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "760px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "28px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.09)",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: "10px",
    marginBottom: "18px",
    color: "#334155",
  },
  form: {
    display: "grid",
    gap: "12px",
  },
  textarea: {
    width: "100%",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    padding: "12px",
    fontSize: "15px",
    resize: "vertical",
    outline: "none",
  },
  button: {
    border: "none",
    borderRadius: "12px",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 18px",
    cursor: "pointer",
  },
  error: {
    marginTop: "14px",
    color: "#b91c1c",
    fontWeight: 500,
  },
  resultBox: {
    marginTop: "18px",
    border: "1px solid",
    borderRadius: "12px",
    padding: "14px",
  },
  resultTitle: {
    margin: "0 0 6px 0",
    fontSize: "20px",
    color: "#0f172a",
  },
  resultReason: {
    margin: 0,
    color: "#334155",
  },
};
