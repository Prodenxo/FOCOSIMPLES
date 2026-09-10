export function Card({ children, className = '', as: Tag = 'div' }) {
  return (
    <Tag
      className={`rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </Tag>
  );
}
