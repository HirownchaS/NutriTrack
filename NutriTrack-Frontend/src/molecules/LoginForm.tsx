import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Input from "../atoms/Input";
import Button from "../atoms/Button";
import Card from "../atoms/Card";
import { useAuth } from "../context/AuthContext";
import { loginUser, getUserRole } from "../firebase/auth";

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Sign in with Firebase
      const firebaseUser = await loginUser(email, password);

      // Fetch role from Firestore
      const roleData = await getUserRole(firebaseUser.uid);

      if (!roleData) {
        setError("Account data not found. Please contact support.");
        return;
      }

      // Save data to context
      login({
        uid: firebaseUser.uid,
        role: roleData.role,
        email: firebaseUser.email || email,
        name: roleData.name,
        profileComplete: roleData.profileComplete,
      });

      // If profile is not complete (user role only), go to profile setup
      if (roleData.role === "user" && !roleData.profileComplete) {
        navigate("/profile-setup");
        return;
      }

      // Redirect based on role
      if (roleData.role === "admin") navigate("/admin");
      else if (roleData.role === "nutritionist")
        navigate("/nutritionist-dashboard");
      else navigate("/dashboard");
    } catch (err: unknown) {
      let errorMsg = "Login failed. Please check your credentials.";
      if (err instanceof Error) {
        if (
          err.message.includes("user-not-found") ||
          err.message.includes("wrong-password") ||
          err.message.includes("invalid-credential")
        ) {
          errorMsg = "Invalid email or password.";
        } else if (err.message.includes("too-many-requests")) {
          errorMsg = "Too many attempts. Please try again later.";
        } else if (err.message.includes("user-disabled")) {
          errorMsg = "This account has been disabled.";
        } else {
          errorMsg = err.message;
        }
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-800">Welcome Back</h2>
        <p className="text-slate-500 mt-2">Sign in to track your nutrition</p>
      </div>

      {error && (
        <div
          className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <Input
          id="login-email"
          label="Email Address"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="login-password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          showPasswordToggle
        />
        {/* Forgot password link */}
        <div className="flex justify-end -mt-2">
          <Link
            to="/forgot-password"
            className="text-sm text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
          >
            Forgot Password?
          </Link>
        </div>
        <Button
          type="submit"
          variant="primary"
          className="w-full py-3 text-lg font-bold"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      {/* Register link */}
      <div className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
        >
          Create Account
        </Link>
      </div>
    </Card>
  );
};

export default LoginForm;
