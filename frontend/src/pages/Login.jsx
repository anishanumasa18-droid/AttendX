import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Camera, CheckCircle2, User, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import logo from '../assets/logo_refined.png';

export default function Login({ setUser }) {
  const [step, setStep] = useState('roleSelection');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [branch, setBranch] = useState('');
  const videoRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [faceImage, setFaceImage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => stopCamera();
  }, [step, isCameraOpen]);

  const startCamera = async () => {
    setErrorMsg('');
    try {
      let stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {

     videoRef.current.srcObject = stream;

     await videoRef.current.play();
}
      setIsCameraOpen(true);
    } catch (err) {
      setErrorMsg('Camera access failed. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureFace = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      setFaceImage(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

        // =========================
    // PASSWORD VALIDATION
    // =========================

    const passwordValue =
      password.trim();

    const hasUpper =
      /[A-Z]/.test(passwordValue);

    const hasLower =
      /[a-z]/.test(passwordValue);

    const hasNumber =
      /\d/.test(passwordValue);

    const hasSpecial =
      /[@$!%*?&]/.test(passwordValue);

    const hasLength =
      passwordValue.length >= 8;

    if (
      step === 'signup' &&
      (
        !hasUpper ||
        !hasLower ||
        !hasNumber ||
        !hasSpecial ||
        !hasLength
      )
    ) {

      setErrorMsg(
        'Password must contain:\n' +
        '• Uppercase letter\n' +
        '• Lowercase letter\n' +
        '• Number\n' +
        '• Special character\n' +
        '• Minimum 8 characters'
      );

      setLoading(false);

      return;
    }

    // =========================
    // STUDENT EMAIL VALIDATION
    // =========================

    const studentEmailPattern =
      /^b\d{2}[a-z]{2}\d{3}@kitsw\.ac\.in$/;

    if (
      role === 'student' &&
      step === 'signup' &&
      !studentEmailPattern.test(
        email.toLowerCase()
      )
    ) {

      setErrorMsg(
        'Student email must be like b24in001@kitsw.ac.in'
      );

      setLoading(false);

      return;
    }

    // =========================
    // FACULTY EMAIL VALIDATION
    // =========================

    const facultyPattern =
      /^[a-z]+(\.[a-z]+)?@kitsw\.ac\.in$/;

    if (
      role === 'faculty' &&
      step === 'signup' &&
      !facultyPattern.test(
        email.toLowerCase()
      )
    ) {

      setErrorMsg(
        'Faculty email must be like name.cse@kitsw.ac.in'
      );

      setLoading(false);

      return;
    }

    // =========================
    // ROLL NUMBER VALIDATION
    // =========================

    const rollPattern =
      /^b\d{2}[a-z]{2}\d{3}$/;

    if (
      role === 'student' &&
      step === 'signup' &&
      !rollPattern.test(
        rollNumber.toLowerCase()
      )
    ) {

      setErrorMsg(
        'Roll number must be like b24in001'
      );

      setLoading(false);

      return;
    }

    // =========================
    // ROLL ↔ EMAIL MATCH
    // =========================

    const emailBody =
      email.split('@')[0].toLowerCase();

    if (
      role === 'student' &&
      step === 'signup' &&
      rollNumber.toLowerCase() !== emailBody
    ) {

      setErrorMsg(
        'Roll number must match Domain email'
      );

      setLoading(false);

      return;
    }

    
    try {
      const endpoint =
  step === 'signup'
    ? 'https://attendx-6ksy.onrender.com/api/auth/signup'
    : 'https://attendx-6ksy.onrender.com/api/auth/login';
      const payload = { email, password, role, name };
      if (role === 'student') {

      payload.roll_number = rollNumber;

     payload.branch = branch;
}

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Authentication failed');
            // =========================
      // FACE REGISTRATION
      // =========================

      if (
        step === 'signup' &&
        role === 'student' &&
        faceImage
      ) {

        const faceResponse = await fetch(
          'https://attendx-6ksy.onrender.com/api/register_face',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email,
              face_image_b64: faceImage
            })
          }
        );

        const faceData =
          await faceResponse.json();

        if (!faceResponse.ok) {

          throw new Error(
            faceData.detail ||
            'Face registration failed'
          );
        }
      }

      setUser({ role: data.role || role, email: data.email || email, user_id: data.user_id });
      if (
        step === 'signup' &&
       role === 'student'
      ) {

  navigate(
    `/register-face?email=${email}`
  );

    } else {

    navigate(`/${data.role || role}`);
   }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'roleSelection') {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center pt-20 px-6">
        <div className="mb-12">
          <div className="w-28 h-28 rounded-full bg-white border border-[#e5e5e0] flex items-center justify-center shadow-md overflow-hidden">
            <img src={logo} alt="AttendX" className="w-16 h-16 object-contain" />
          </div>
        </div>
        
        <div className="max-w-3xl w-full text-center mb-16">
          <div className="accent-pill mb-6 mx-auto">
            <ShieldCheck className="w-4 h-4" />
            <span>Identity Secured Attendance</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            We help students and faculty work together.
          </h1>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            The next generation of attendance tracking, handling verification, 
            compliance, and reporting with AI-driven precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl">
          <button 
            onClick={() => { setRole('student'); setStep('login'); }}
            className="btn-primary group"
          >
            <span>Student Login</span>
            <LogIn className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          
          <button 
            onClick={() => { setRole('faculty'); setStep('login'); }}
            className="btn-secondary group"
          >
            <span>Faculty Login</span>
            <LogIn className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <footer className="mt-auto py-12 text-neutral-400 text-sm">
          &copy; 2026 AttendX Platform. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-20 px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <button 
          onClick={() => setStep('roleSelection')}
          className="flex items-center gap-2 text-neutral-500 hover:text-[#1a1a1a] transition-colors mb-12 ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Selection</span>
        </button>

        <div className="glass-card bg-white p-10 shadow-xl border border-[#e5e5e0] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-10 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white border border-[#e5e5e0] flex items-center justify-center shadow-sm overflow-hidden mb-8">
              <img src={logo} alt="AttendX" className="w-12 h-12 object-contain" />
            </div>
            <h2 className="text-4xl font-bold mb-2 serif-font tracking-tight">
              {step === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-neutral-500 text-sm">
              Sign in as <span className="text-[#1a1a1a] font-bold uppercase tracking-widest">{role}</span> to access your dashboard
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50/50 border border-rose-100 text-rose-600 p-4 rounded-xl text-sm mb-8 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">
            {step === 'signup' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wider text-[10px]">Full Name</label>
                  <input type="text" required className="input-field" placeholder={ role === 'faculty' ? 'Dorthi kumar' : 'Nagacharan velisoju' } value={name} onChange={e => setName(e.target.value)} />
                </div>
                {role === 'student' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wider text-[10px]">Roll Number</label>
                      <input type="text" required className="input-field" placeholder="B24in001" value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wider text-[10px]">Branch</label>
                      <input type="text" required className="input-field" placeholder="CSE" value={branch} onChange={e => setBranch(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wider text-[10px]">Institutional Email</label>
              <input type="email" required className="input-field" placeholder={
  role === 'student'
    ? 'b24in001@kitsw.ac.in'
    : 'name.cse@kitsw.ac.in'
} value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wider text-[10px]">Password</label>
              <input type="password" required className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword( e.target.value.replace(/\s/g, '') ) } />
            </div>

            

            <button type="submit" disabled={loading} className="btn-primary mt-4">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (step === 'signup' ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-10 text-center border-t border-[#f0f0eb] pt-8">
            <p className="text-sm text-neutral-500">
              {step === 'signup' ? "Already have an account?" : "Don't have an account?"}{' '}
              <button 
                onClick={() => setStep(step === 'signup' ? 'login' : 'signup')}
                className="text-[#1a1a1a] font-bold hover:underline"
              >
                {step === 'signup' ? 'Sign in instead' : 'Join AttendX today'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

