import React, { useState } from 'react';

interface AprilAvatarProps {
  size?: 'sm' | 'md' | 'lg';
}

export const AprilAvatar: React.FC<AprilAvatarProps> = ({ size = 'md' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-9 h-9 rounded-xl'
      : size === 'lg'
        ? 'w-14 h-14 rounded-2xl'
        : 'w-11 h-11 rounded-xl';

  if (imgFailed) {
    return (
      <div
        aria-label="Emblema de April IA"
        className={`${dims} bg-[#2D5A43] text-[#F6F5F1] flex items-center justify-center font-display font-bold shrink-0`}
      >
        A
      </div>
    );
  }

  return (
    <img
      src="/src/assets/images/april_avatar_1794962736276.jpg"
      alt="Emblema minimalista de April IA"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${dims} object-cover border border-[#E5E3DC] dark:border-[#2C332F] shrink-0`}
    />
  );
};
