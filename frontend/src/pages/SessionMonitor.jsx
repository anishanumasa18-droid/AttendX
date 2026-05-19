import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { UserCheck, StopCircle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function SessionMonitor() {
  const { id } = useParams();
  const [isActive, setIsActive] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [qrToken, setQrToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveScans, setLiveScans] = useState([]);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');

  const [topic, setTopic] = useState('');

 const [sessionDate, setSessionDate] = useState('');
 const [sessionTime, setSessionTime] = useState('');

 const [batch, setBatch] = useState('Both');

 const [sessionType, setSessionType] = useState('Theory');
 const [semester, setSemester] = useState('I');

const [branch, setBranch] = useState('CSE');

const [section, setSection] = useState('1');
  useEffect(() => {

   const qrInterval = setInterval(() => {

      if(sessionId && isActive) {
         refreshQRCode()
      }

   }, 12000)

   return () => clearInterval(qrInterval)

}, [sessionId, isActive])
const createSession = async () => {
if (
  !courseCode ||
  !courseName ||
  !topic ||
  !sessionDate ||
  !sessionTime
) {

  alert("Please fill all session details");

  return;
}
  try {

    setLoading(true);

    const response = await fetch(
      'https://attendx-6ksy.onrender.com/api/sessions/create',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          course_id: courseCode,

          course_code: courseCode,
          course_name: courseName,

          class_number: 1,

          duration_minutes: 5,

          topic,

          session_date: sessionDate,
          session_time: sessionTime,

          batch,
          session_type: sessionType,
          semester,
          branch,
          section,
        })
        
      }
    
    );

    const data = await response.json();
    if (!response.ok) {

  alert(data.detail || "Failed to create session");

  setLoading(false);

  return;
}

    setQrToken(data.qr_token);

    setSessionId(data.session_id);
    setTimeLeft(60 * 5);

    localStorage.setItem(
      "sessionId",
      data.session_id
    );

    setLoading(false);

  } catch(err) {

    console.error(err);

    setLoading(false);

  }

}

  useEffect(() => {
    if (!sessionId || !isActive) return;
    const interval = setInterval(() => {
     fetch(`https://attendx-6ksy.onrender.com/api/sessions/${sessionId}/scans`)
  .then(res => res.json())
  .then(data => setLiveScans(data))
  .catch(err => console.error("Poll error", err));
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId, isActive]);

  useEffect(() => {
    if (!isActive || !sessionId) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleEndSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, sessionId]);
  const refreshQRCode = async () => {

   try {

      const res = await fetch(
         `https://attendx-6ksy.onrender.com/api/sessions/${sessionId}/refresh_qr`
      )

      const data = await res.json()
      console.log("NEW QR TOKEN:", data.qr_token);
      console.log("NEW NONCE:", data.nonce);
      if(res.ok) {

         setQrToken(data.qr_token)

      }

   } catch(err) {

      console.error(err)

   }
}
  const handleEndSession = () => {
    setIsActive(false);
    setQrToken('');
    if (sessionId) {
      fetch(`https://attendx-6ksy.onrender.com/api/sessions/${sessionId}/close`, { method: 'POST' }).catch(err => console.error("Close error", err));
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <button onClick={() => window.history.back()} className="flex items-center gap-2 text-neutral-500 hover:text-[#1a1a1a] transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Management</span>
          </button>
          <div className="accent-pill mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>Active Session Monitor</span>
          </div>
          <h2 className="text-5xl font-bold serif-font tracking-tight">Session: {id}</h2>
        </div>
        
       
          {isActive ? (

  <div className="bg-emerald-50 border border-emerald-100 px-8 py-4 rounded-3xl text-emerald-700 font-bold serif-font text-2xl">
    Session Active
  </div>

) : (

  <div className="bg-[#f9f9f5] border border-[#e5e5e0] px-8 py-4 rounded-3xl text-neutral-400 font-bold serif-font text-2xl">
    Session Terminalized
  </div>

)}
        
      </div>
      <div className="grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 glass-card p-6 space-y-4">

  <h3 className="text-2xl font-bold serif-font">
    Session Details
  </h3>

  <input
    type="text"
    placeholder="Course Code"
    value={courseCode}
    onChange={(e) => setCourseCode(e.target.value)}
    className="w-full border p-3 rounded-xl"
  />

  <input
    type="text"
    placeholder="Course Name"
    value={courseName}
    onChange={(e) => setCourseName(e.target.value)}
    className="w-full border p-3 rounded-xl"
  />

  <input
    type="text"
    placeholder="Topic"
    value={topic}
    onChange={(e) => setTopic(e.target.value)}
    className="w-full border p-3 rounded-xl"
  />

  <input
    type="date"
    value={sessionDate}
    onChange={(e) => setSessionDate(e.target.value)}
    className="w-full border p-3 rounded-xl"
  />

  <input
    type="time"
    value={sessionTime}
    onChange={(e) => setSessionTime(e.target.value)}
    className="w-full border p-3 rounded-xl"
  />

  <div className="space-y-2">

  <p className="font-semibold">
    Select Batch
  </p>

  <div className="flex gap-6">

    <label className="flex items-center gap-2 cursor-pointer">

      <input
        type="radio"
        value="1"
        checked={batch === '1'}
        onChange={(e) => setBatch(e.target.value)}
      />

      <span>Batch 1</span>

    </label>

    <label className="flex items-center gap-2 cursor-pointer">

      <input
        type="radio"
        value="2"
        checked={batch === '2'}
        onChange={(e) => setBatch(e.target.value)}
      />

      <span>Batch 2</span>

    </label>

    <label className="flex items-center gap-2 cursor-pointer">

      <input
        type="radio"
        value="Both"
        checked={batch === 'Both'}
        onChange={(e) => setBatch(e.target.value)}
      />

      <span>Both</span>

    </label>

  </div>
  <div className="space-y-2">

  <p className="font-semibold">
    Select Semester
  </p>

  <div className="flex gap-4 flex-wrap">

    {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map((sem) => (

      <label
        key={sem}
        className="flex items-center gap-2 cursor-pointer"
      >

        <input
          type="radio"
          value={sem}
          checked={semester === sem}
          onChange={(e) => setSemester(e.target.value)}
        />

        <span>{sem}</span>

      </label>

    ))}

  </div>

</div>
<div className="space-y-2">

  <p className="font-semibold">
    Select Branch
  </p>

  <div className="flex gap-4 flex-wrap">

    {['CSE', 'ECE', 'EEE', 'AIML', 'MECH', 'CIVIL'].map((b) => (

      <label
        key={b}
        className="flex items-center gap-2 cursor-pointer"
      >

        <input
          type="radio"
          value={b}
          checked={branch === b}
          onChange={(e) => setBranch(e.target.value)}
        />

        <span>{b}</span>

      </label>

    ))}

  </div>

</div>
<div className="space-y-2">

  <p className="font-semibold">
    Select Section
  </p>

  <div className="flex gap-4">

    {['1', '2', '3'].map((sec) => (

      <label
        key={sec}
        className="flex items-center gap-2 cursor-pointer"
      >

        <input
          type="radio"
          value={sec}
          checked={section === sec}
          onChange={(e) => setSection(e.target.value)}
        />

        <span>{sec}</span>

      </label>

    ))}

  </div>

</div>

</div>

  <select
    value={sessionType}
    onChange={(e) => setSessionType(e.target.value)}
    className="w-full border p-3 rounded-xl"
  >
    <option>Theory</option>
    <option>Lab</option>
    <option>Tutorial</option>
  </select>
  <button
  onClick={createSession}
  disabled={loading}
  className="btn-primary w-full"
>
  {loading ? "Generating..." : "Generate Secure QR Session"}
</button>

</div>
<div className="lg:col-span-4 glass-card p-12 flex flex-col items-center justify-center relative bg-white min-h-[450px]">

  {isActive ? (

    loading ? (

      <div className="flex flex-col items-center gap-4">

        <Loader2 className="w-12 h-12 text-[#1a1a1a] animate-spin" />

        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          Generating Secure QR
        </p>

      </div>

    ) : qrToken ? (

      <div className="space-y-10 flex flex-col items-center">

        <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-[#f0f0eb]">

          <QRCodeSVG value={qrToken} size={280} level="H" />

        </div>

        <p className="text-center text-neutral-500 text-sm max-w-xs leading-relaxed italic">
          "Signed via HS256. Students must complete identity verification before scanning."
        </p>

        <button
          onClick={handleEndSession}
          className="btn-secondary text-rose-600 border-rose-100 hover:bg-rose-50 px-8"
        >
          <StopCircle className="w-5 h-5" />

          <span>End Session Now</span>

        </button>

      </div>

    ) : (

      <div className="text-center text-neutral-400 italic">

        Generate a session to display secure QR

      </div>

    )

  ) : (

    <div className="text-center space-y-6">

      <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">

        <StopCircle className="w-12 h-12 text-neutral-300" />

      </div>

      <h3 className="text-3xl font-bold serif-font text-neutral-400">
        Access Restricted
      </h3>

      <p className="text-neutral-500 max-w-xs">
        This session is no longer accepting student signatures.
      </p>

    </div>

  )}

</div>

 

        <div className="lg:col-span-4">
          <div className="glass-card flex flex-col h-full overflow-hidden min-h-[450px]">
            <div className="p-8 border-b border-[#f0f0eb] flex justify-between items-end bg-white">
              <div>
                <h3 className="text-3xl font-bold serif-font mb-2">Live Registry</h3>
                <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold text-[10px]">Real-time synchronization active</p>
              </div>
              <div className="text-right">
                <span className="text-5xl font-bold serif-font">{liveScans.length}</span>
                <span className="text-xl text-neutral-400 font-bold serif-font ml-2">/ 60</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-1">Confirmed Presence</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4 max-h-[500px]">
              {liveScans.length === 0 && !loading && isActive && (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400 italic">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-20" />
                  <p>Awaiting first student verification...</p>
                </div>
              )}
              
              {liveScans.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-6 bg-white border border-[#f0f0eb] rounded-2xl animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white border border-[#e5e5e0] rounded-full flex items-center justify-center font-bold text-xs">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold serif-font text-lg">{s.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{s.roll}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="accent-pill !bg-emerald-50 text-emerald-700 !px-3 !py-1 text-[10px]">
                      <UserCheck className="w-3 h-3" />
                      <span>Verified</span>
                    </div>
                    <p className="text-[10px] font-bold text-neutral-400 mt-2">{s.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
