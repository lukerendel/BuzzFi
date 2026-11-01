export function Banner({ notice, error }: { notice?: string; error?: string }) {
  if (error) {
    return (
      <p className="banner banner-error" role="alert">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className="banner" role="status">
        {notice}
      </p>
    );
  }
  return null;
}
