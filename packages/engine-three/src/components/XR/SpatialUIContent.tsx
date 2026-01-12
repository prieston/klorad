"use client";

import { useEffect, useState, useMemo } from "react";

interface SupportiveData {
  images?: Array<{ url: string; caption?: string }>;
  pdfs?: Array<{ url: string; title?: string }>;
  textDescriptions?: Array<{ title?: string; content: string }>;
  externalLinks?: Array<{ label: string; url: string; description?: string }>;
}

interface SpatialUIContentProps {
  assetId: string;
  projectId?: string;
  onClose: () => void;
}

export const SpatialUIContent: React.FC<SpatialUIContentProps> = ({
  assetId,
  projectId,
  onClose,
}) => {
  const [supportiveData, setSupportiveData] = useState<SupportiveData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setLoading(false);
      return;
    }

    const fetchSupportiveData = async () => {
      try {
        setLoading(true);
        const url = projectId
          ? `/api/models/${assetId}?projectId=${projectId}`
          : `/api/models/${assetId}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch supportive data");
        }

        const data = await response.json();
        const metadata = data.metadata as Record<string, unknown> | undefined;
        const supportiveData =
          (metadata?.supportiveData as SupportiveData) || null;

        setSupportiveData(supportiveData);
        setError(null);
      } catch (err) {
        console.error("Error fetching supportive data:", err);
        setError("Failed to load supportive data");
      } finally {
        setLoading(false);
      }
    };

    fetchSupportiveData();
  }, [assetId, projectId]);

  const hasData = useMemo(() => {
    if (!supportiveData) return false;
    return (
      (supportiveData.images && supportiveData.images.length > 0) ||
      (supportiveData.pdfs && supportiveData.pdfs.length > 0) ||
      (supportiveData.textDescriptions &&
        supportiveData.textDescriptions.length > 0) ||
      (supportiveData.externalLinks && supportiveData.externalLinks.length > 0)
    );
  }, [supportiveData]);

  if (loading) {
    return (
      <mesh>
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color={0x333333} transparent opacity={0.9} />
      </mesh>
    );
  }

  if (error || !hasData) {
    return (
      <mesh>
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color={0x333333} transparent opacity={0.9} />
      </mesh>
    );
  }

  // For now, return a simple placeholder
  // Full implementation would render text/images as textures
  return (
    <group>
      {/* Background plane */}
      <mesh>
        <planeGeometry args={[3, 4]} />
        <meshBasicMaterial color={0x1a1a1a} transparent opacity={0.95} />
      </mesh>

      {/* Close button indicator */}
      <mesh position={[1.3, 1.7, 0.01]} onClick={onClose}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color={0xff0000} transparent opacity={0.8} />
      </mesh>

      {/* Content placeholder - would be replaced with actual text/image rendering */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[2.5, 3.5]} />
        <meshBasicMaterial color={0x2a2a2a} transparent opacity={0.9} />
      </mesh>
    </group>
  );
};
