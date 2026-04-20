interface StatusBannerProps {
  tone: "error" | "info" | "success";
  title: string;
  messages: string[];
}

export function StatusBanner({ tone, title, messages }: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${tone}`}>
      <strong>{title}</strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
