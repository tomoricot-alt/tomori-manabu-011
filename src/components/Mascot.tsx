// CSSだけで作ったキャラクター「まなぶん」(外部画像は使わない)
export function Mascot({ label = 'まなぶん' }: { label?: string }) {
  return (
    <div className="mascot" role="img" aria-label={label}>
      <div className="sprout" />
      <div className="body" />
      <div className="eye l" />
      <div className="eye r" />
      <div className="cheek l" />
      <div className="cheek r" />
      <div className="mouth" />
    </div>
  );
}
