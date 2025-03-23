"use client";
import axios from "axios";
import { useState, CSSProperties } from "react";
import BounceLoader from "react-spinners/BounceLoader";
import { config } from "dotenv";
config();

interface videoUrl {
  format: string;
  url: string;
}

const override: CSSProperties = {
  display: "block",
  margin: "0 auto",
  borderColor: "red",
};

const uploadVIdeo = () => {
  const [video, setVideo] = useState<File | null>(null);
  const [videoURls, setvideoURls] = useState<videoUrl[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  let [color, setColor] = useState("#000000");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!video) {
      console.log("No video selected");
      return;
    }

    setIsLoading(true);
    //upload-pre-signed-url
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URI}/api/v1/transcoder/upload-pre-signed-url`,
      {
        name: video!.name,
        type: video!.type,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("res", res);
    const { url, videoId } = res.data;
    console.log("url", url);
    console.log("videoid", videoId);

    const uploadResponse = await axios.put(url, video, {
      headers: {
        "Content-Type": video!.type,
      },
    });

    if (uploadResponse.status === 200) {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URI}/start`,
        {
          videoId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("File uploaded successfully!");
      setTimeout(() => {
        console.log("videoid1", videoId);
        checkStatusAndGetBlobs(videoId);
      }, 3000);
    } else {
      console.log("File upload failed:", uploadResponse.statusText);
    }
  };

  const checkStatusAndGetBlobs = async (videoId: string) => {
    try {
      const videoFormats = ["360p", "480p", "720p"];
      const completedFormats: string[] = [];

      const fetchVideoBlob = async (format: string) => {
        const videoKey = `${videoId}-${format}.mp4`;
        try {
          const res = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URI}/api/v1/transcoder/get-pre-signed-url`,
            { videoId: videoKey },
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
          console.log("res", res);
          const { url } = res.data;

          console.log("url", url);

          const videoBlob = await axios.get(url, { responseType: "blob" });

          console.log(`Video for format ${format} fetched successfully.`);
          return { format, url: URL.createObjectURL(videoBlob.data) };
        } catch (error) {
          console.log(`Video format ${format} not ready yet. Retrying...`);
          return null;
        }
      };

      const checkAllFormats = async () => {
        for (const format of videoFormats) {
          if (!completedFormats.includes(format)) {
            const result = await fetchVideoBlob(format);
            if (result) {
              setvideoURls((prev) => [...(prev || []), result]);
              completedFormats.push(result.format);
            }
          }
        }

        if (completedFormats.length < videoFormats.length) {
          setTimeout(checkAllFormats, 5000); // Retry after 5 seconds.
        } else {
          console.log("All video formats are ready.");
          setIsLoading(false);
        }
      };

      checkAllFormats();
    } catch (error) {
      console.error("Error while checking video status:", error);
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.files);
    const file = e.target.files![0];

    setVideo(file);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center flex-col justify-center">
        <BounceLoader
          color={color}
          loading={isLoading}
          cssOverride={override}
          size={70}
          aria-label="Loading Spinner"
          data-testid="loader"
        />
        <h1 className="font-bold text-xl mt-8"> Please wait Loading ...</h1>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-10 mt-24">
    <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8 w-full max-w-3xl mx-auto">
      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-bold text-purple-800 mb-4">YiBe</h1>
        <p className="text-gray-400 text-sm mb-4">- Video Transcoder</p>
        <p className="text-gray-600 text-center mb-8">
          Upload your video and get different formats like <b>360P</b>, <b>480P</b>, and <b>720P</b>.
        </p>
        <input
          type="file"
          name="video"
          onChange={handleChange}
          className="bg-gray-100 p-3 rounded-lg border border-gray-300 w-full mb-6 focus:ring-2 focus:ring-purple-400"
        />
        <button
          type="submit"
          className="bg-purple-800 hover:bg-purple-900 text-white font-semibold py-3 px-6 rounded-lg shadow-md cursor-pointer"
        >
          Upload
        </button>
      </div>
    </form>
  
    <div className="video-gallery mt-16 px-4">
      {videoURls && videoURls.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videoURls.map((videoUrl: videoUrl, index) => (
            <div key={index} className="bg-white shadow-md rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Video {index + 1}</h3>
              <p className="text-sm text-gray-500 mb-4">Format: {videoUrl.format}</p>
              <video
                src={videoUrl.url}
                controls
                className="w-full rounded-lg border border-gray-300"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center">No videos uploaded yet.</p>
      )}
    </div>
  </div>
  
  );
};

export default uploadVIdeo;
