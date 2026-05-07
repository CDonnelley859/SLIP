import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
    <h1 className="text-headline-xl font-black tracking-tighter">404</h1>
    <p className="text-label-caps text-muted-foreground uppercase mt-2 mb-8">
      Slip not found
    </p>
    <Link
      to="/"
      className="text-label-caps uppercase underline underline-offset-4 decoration-[2.67px]"
    >
      Back to Paddock
    </Link>
  </div>
);

export default NotFound;
