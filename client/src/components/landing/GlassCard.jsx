export default function GlassCard({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`rounded-2xl border border-line-soft bg-surface/55 backdrop-blur-xl backdrop-saturate-150 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
