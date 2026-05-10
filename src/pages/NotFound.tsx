import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--green)" }}>
    <h1 className="display" style={{ fontSize: 96, color: "var(--cream)", lineHeight: 1 }}>404</h1>
    <p className="label" style={{ color: "var(--cream)", opacity: 0.6, marginTop: 8, marginBottom: 32 }}>
      SLIP NOT FOUND
    </p>
    <Link
      to="/"
      className="label"
      style={{ color: "var(--cream)", textDecoration: "underline" }}
    >
      BACK TO PADDOCK
    </Link>
  </div>
);

export default NotFound;
