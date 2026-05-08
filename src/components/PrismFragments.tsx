import { useEffect, useState } from "react";

interface Fragment {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
  color: string;
}

const colors = [
  "from-purple-500/40 to-fuchsia-500/20",
  "from-cyan-500/40 to-blue-500/20",
  "from-pink-500/40 to-purple-500/20",
  "from-violet-500/40 to-indigo-500/20",
  "from-fuchsia-500/40 to-pink-500/20",
  "from-blue-500/40 to-cyan-500/20",
];

const PrismFragments = () => {
  const [fragments, setFragments] = useState<Fragment[]>([]);

  useEffect(() => {
    const generateFragments = () => {
      const newFragments: Fragment[] = [];
      const count = 20;

      for (let i = 0; i < count; i++) {
        newFragments.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 10,
          duration: 8 + Math.random() * 12,
          size: 10 + Math.random() * 30,
          rotation: Math.random() * 360,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      setFragments(newFragments);
    };

    generateFragments();
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {fragments.map((fragment) => (
        <div
          key={fragment.id}
          className="absolute animate-prism-fall"
          style={{
            left: `${fragment.left}%`,
            animationDelay: `${fragment.delay}s`,
            animationDuration: `${fragment.duration}s`,
          }}
        >
          {/* Prism shape */}
          <div
            className={`relative bg-gradient-to-br ${fragment.color} backdrop-blur-sm`}
            style={{
              width: `${fragment.size}px`,
              height: `${fragment.size * 1.5}px`,
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              transform: `rotate(${fragment.rotation}deg)`,
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)",
            }}
          >
            {/* Inner glow */}
            <div 
              className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/40"
              style={{
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            />
          </div>
        </div>
      ))}

      {/* Additional sparkle effects */}
      {fragments.slice(0, 10).map((fragment) => (
        <div
          key={`sparkle-${fragment.id}`}
          className="absolute animate-prism-fall"
          style={{
            left: `${(fragment.left + 50) % 100}%`,
            animationDelay: `${fragment.delay + 5}s`,
            animationDuration: `${fragment.duration + 4}s`,
          }}
        >
          <div
            className="w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              boxShadow: "0 0 10px 2px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(168, 85, 247, 0.5)",
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default PrismFragments;
