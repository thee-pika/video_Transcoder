"use client";
import React, { useState } from "react";
import axios from "axios";
import { config } from "dotenv";
config();

interface videoUrl {
  format: string;
  url: string;
}
const uploadVIdeo = () => {
  const [video, setVideo] = useState<File | null>(null);
  const [videoURls, setvideoURls] = useState<videoUrl[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
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
              setvideoURls((prev) => [...(prev || [] ), result]);
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

  if(isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col items-center justify-center mx-auto mt-20">
          <h1>
            {" "}
            UPload VIdeo and get diferent formats of that video 360P , 480P ,
            720P, 1080P
          </h1>
          <input
            type="file"
            name="video"
            onChange={handleChange}
            className="form bg-gray-100 p-4 rounded-md borde border-black mt-12"
          />
          <button
            type="submit"
            className="bg-purple-800 rounded-md p-4 px-8 mt-8 text-white"
          >
            Upload
          </button>
        </div>
      </form>

      <div className="video-gallery mt-12 flex justify-evenly">
        {videoURls && videoURls.length > 0
          ? videoURls.map((videoUrl: videoUrl, index) => (
              <div key={index} className="video-container mt-6">
                <h3>Video {index + 1}</h3>
                <p> {videoUrl.format} </p>
                <video
                  src={videoUrl.url}
                  controls
                  className="w-full max-w-lg border border-gray-300 rounded-md"
                />
              </div>
            ))
          : ""}
      </div>
    </div>
  );
};

export default uploadVIdeo;
