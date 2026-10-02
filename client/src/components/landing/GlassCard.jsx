export default function GlassCard({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`rounded-2xl border border-line-soft bg-surface shadow-[0_30px_60px_-30px_rgba(22,18,14,0.6)] ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
