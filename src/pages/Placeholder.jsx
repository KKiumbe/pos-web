import './Placeholder.css';

export default function Placeholder({ title }) {
  return (
    <div className="placeholder-page">
      <h1 className="placeholder-title">{title}</h1>
      <p className="placeholder-body">This section is coming soon.</p>
    </div>
  );
}
