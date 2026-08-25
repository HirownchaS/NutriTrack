import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Input from "../atoms/Input";
import Button from "../atoms/Button";
import Card from "../atoms/Card";
import { verifyResetCode, resetPassword } from "../firebase/auth";

const ResetPasswordForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [email, setEmail] = useState("");

  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError("Invalid reset link. No reset code found.");
        setIsVerifying(false);
        return;
      }

      try {
        const userEmail = await verifyResetCode(oobCode);
        setEmail(userEmail);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!oobCode) {
      setError("Missing reset code.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(oobCode, password);
      setSuccess(true);

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <Card className="w-full max-w-md p-8 bg-white/80 backdrop-blur-lg shadow-xl rounded-2xl flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium">Verifying reset link...</p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8 bg-white/80 backdrop-blur-lg shadow-xl rounded-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-800">
          Set New Password
        </h2>
        {email && (
          <p className="text-slate-500 mt-2">
            Resetting password for{" "}
            <span className="font-semibold text-emerald-600">{email}</span>
          </p>
        )}
      </div>

      {error && (
        <div
          className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium"
          role="alert"
        >
          {error}
        </div>
      )}

      {success ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            ✓
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Success!</h3>
          <p className="text-slate-600 mb-6">
            Password reset successful. Redirecting to login...
          </p>
          <Link to="/login">
            <Button variant="primary" className="w-full">
              Go to Login Now
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="new-password"
            label="New Password"
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={!!error && !email}
            showPasswordToggle
          />
          <Input
            id="confirm-password"
            label="Confirm New Password"
            type="password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={!!error && !email}
            showPasswordToggle
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-lg font-bold"
            disabled={isLoading || (!!error && !email)}
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
                Resetting Password...
              </span>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      )}

      {!success && (
        <div className="mt-6 text-center text-sm text-slate-500">
          <Link
            to="/login"
            className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      )}
    </Card>
  );
};

export default ResetPasswordForm;
