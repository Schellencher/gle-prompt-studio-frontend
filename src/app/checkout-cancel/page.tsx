"use client";

import React from "react";

export default function CheckoutCancelPage() {
  const goBack = () => {
    window.location.href = "/";
  };

  return (
    <div
      style={{ minHeight: "100vh", background: "#050608", color: "#f5f5f7" }}
    >
      <div style={{ maxWidth: 560, margin: "80px auto", padding: 20 }}>
        <h1
          style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#ff7043" }}
        >
          Checkout abgebrochen
        </h1>

        <p style={{ opacity: 0.85, marginTop: 12 }}>
          Kein Problem — du kannst jederzeit wieder upgraden.
        </p>

        <button
          type="button"
          onClick={goBack}
          style={{
            width: "100%",
            marginTop: 18,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #333647",
            fontWeight: 900,
            cursor: "pointer",
            background: "#121218",
            color: "#f5f5f7",
          }}
        >
          Zur App
        </button>
      </div>
    </div>
  );
}
