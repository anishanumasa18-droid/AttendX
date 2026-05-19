import {
  useEffect,
  useRef,
  useState
} from 'react';

import {
  useNavigate,
  useSearchParams
} from 'react-router-dom';

export default function RegisterFace() {

  const videoRef = useRef(null);

  const [stream, setStream] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const navigate = useNavigate();

  const [params] = useSearchParams();

  const email = params.get('email');

  useEffect(() => {

    startCamera();

    return () => {

      if (stream) {

        stream
          .getTracks()
          .forEach(track => track.stop());
      }
    };

  }, []);

  const startCamera = async () => {

    try {

      const mediaStream =
        await navigator
          .mediaDevices
          .getUserMedia({
            video: true
          });

      setStream(mediaStream);

      if (videoRef.current) {

        videoRef.current.srcObject =
          mediaStream;

        await videoRef.current.play();
      }

    } catch (err) {

      alert(
        'Camera access failed'
      );
    }
  };

  const captureFace = async () => {

    setLoading(true);

    try {

      const canvas =
        document.createElement('canvas');

      canvas.width =
        videoRef.current.videoWidth;

      canvas.height =
        videoRef.current.videoHeight;

      const ctx =
        canvas.getContext('2d');

      ctx.drawImage(
        videoRef.current,
        0,
        0
      );

      const faceImage =
        canvas.toDataURL(
          'image/jpeg',
          0.8
        );

      const response =
        await fetch(
          'https://attendx-6ksy.onrender.com/api/register_face',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              email,
              face_image_b64:
                faceImage
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail
        );
      }

      alert(
        'Face registered successfully'
      );

      navigate('/student');

    } catch (err) {

      alert(err.message);

    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">

      <div className="bg-white p-8 rounded-3xl shadow-xl">

        <h1 className="text-2xl font-bold mb-6 text-center">
          Register Face
        </h1>

        <div className="w-[500px] aspect-video bg-black rounded-2xl overflow-hidden">

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />

        </div>

        <button
          onClick={captureFace}
          disabled={loading}
          className="w-full mt-6 bg-black text-white py-3 rounded-xl"
        >
          {
            loading
              ? 'Registering...'
              : 'Capture & Register'
          }
        </button>

      </div>

    </div>
  );
}