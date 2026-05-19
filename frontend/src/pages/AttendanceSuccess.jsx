import { useLocation, useNavigate } from 'react-router-dom';

export default function AttendanceSuccess() {

  const { state } = useLocation();

  const navigate = useNavigate();

  return (

    <div className="max-w-2xl mx-auto p-10">

      <div className="glass-card p-10 space-y-6">

        <h1 className="text-4xl font-bold text-green-500">
          Attendance Marked Successfully
        </h1>

        <div className="space-y-3">

          <p><b>Course Code:</b> {state.course_code}</p>

          <p><b>Course Name:</b> {state.course_name}</p>

          <p><b>Topic:</b> {state.topic}</p>

          <p><b>Date:</b> {state.session_date}</p>

          <p><b>Time:</b> {state.session_time}</p>

          <p><b>Batch:</b> {state.batch}</p>

          <p><b>Session Type:</b> {state.session_type}</p>

        </div>

        <button
          onClick={() => navigate('/student')}
          className="btn-primary w-full"
        >
          Back to Dashboard
        </button>

      </div>

    </div>
  );
}