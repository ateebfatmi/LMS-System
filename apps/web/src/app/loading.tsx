export default function Loading() {
  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-prepzii-body, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "4px solid #f3f4f6",
          borderTop: "4px solid #EAB308",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginBottom: "16px",
        }}
      />
      <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
        Loading PrepZii Workspace...
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
