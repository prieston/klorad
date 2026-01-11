"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  IconButton,
  Typography,
} from "@mui/material";
import { Close, CloudUpload, Folder, Public, Add } from "@mui/icons-material";
import {
  modalPaperStyles,
  modalTitleStyles,
  modalTitleTextStyles,
  modalCloseButtonStyles,
} from "../../styles/modalStyles";
import {
  MyLibraryTab,
  UploadModelTab,
  UploadToIonTab,
  AddIonAssetTab,
  type LibraryAsset,
} from "./tabs";

export interface AssetManagerModalProps {
  open: boolean;
  onClose: () => void;
  // My Library props
  userAssets?: LibraryAsset[];
  onModelSelect?: (model: LibraryAsset) => void;
  onAssetDelete?: (assetId: string) => void;
  onAssetUpdate?: (
    assetId: string,
    updates: {
      name?: string;
      description?: string;
      metadata?: Record<string, string>;
      thumbnail?: string;
    }
  ) => void;
  // Upload Model props
  onCustomModelUpload?: (data: {
    file: File;
    friendlyName: string;
    metadata: Array<{ label: string; value: string }>;
    screenshot: string | null;
  }) => Promise<void>;
  customModelUploading?: boolean;
  customModelUploadProgress?: number;
  // Upload to Ion props
  onCesiumIonUpload?: (data: {
    file: File;
    name: string;
    description: string;
    sourceType: string;
    integrationId?: string;
    accessToken?: string;
    longitude?: number;
    latitude?: number;
    height?: number;
    options?: {
      dracoCompression?: boolean;
      ktx2Compression?: boolean;
      webpImages?: boolean;
      geometricCompression?: string;
      epsgCode?: string;
      makeDownloadable?: boolean;
      tilesetJson?: string;
      gaussianSplats?: boolean;
    };
  }) => Promise<{ assetId: string }>;
  ionUploading?: boolean;
  ionUploadProgress?: number;
  // Add Ion Asset props
  onCesiumAssetAdd?: (data: {
    assetId: string;
    name: string;
    apiKey?: string;
  }) => Promise<unknown>;
  onIonAssetAdded?: () => void;
  // Supportive data render function
  renderSupportiveData?: (asset: LibraryAsset, onUpdate: () => void) => React.ReactNode;
}

const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
  open,
  onClose,
  // My Library
  userAssets = [],
  onModelSelect,
  onAssetDelete,
  onAssetUpdate,
  // Upload Model
  onCustomModelUpload,
  customModelUploading = false,
  customModelUploadProgress = 0,
  // Upload to Ion
  onCesiumIonUpload,
  ionUploading = false,
  ionUploadProgress = 0,
  // Add Ion Asset
  onCesiumAssetAdd,
  onIonAssetAdded,
  // Supportive data
  renderSupportiveData,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleModelSelectWrapper = (model: LibraryAsset) => {
    onModelSelect?.(model);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: modalPaperStyles,
      }}
    >
      {/* Header */}
      <DialogTitle sx={modalTitleStyles}>
        <Typography sx={modalTitleTextStyles}>Asset Manager</Typography>
        <IconButton onClick={onClose} size="small" sx={modalCloseButtonStyles}>
          <Close />
        </IconButton>
      </DialogTitle>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={(theme) => ({
          minHeight: "48px",
          paddingX: "24px",
          paddingY: "4px",
          backgroundColor: theme.palette.background.default,
          "& .MuiTab-root": {
            color: theme.palette.text.secondary,
            minHeight: "40px",
            padding: "8px 12px",
            fontSize: "0.813rem",
            fontWeight: 500,
            flexDirection: "row",
            gap: "6px",
            justifyContent: "center",
            borderRadius: "4px",
            margin: "4px 2px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            textTransform: "none",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(107, 156, 216, 0.12)"
                  : "rgba(107, 156, 216, 0.08)",
              color: theme.palette.primary.main,
            },
            "&.Mui-selected": {
              color: theme.palette.primary.main,
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(95, 136, 199, 0.16)"
                  : "rgba(107, 156, 216, 0.15)",
              fontWeight: 600,
            },
            "& .MuiSvgIcon-root": {
              marginBottom: 0,
              fontSize: "1.1rem",
            },
          },
          "& .MuiTabs-indicator": {
            display: "none",
          },
        })}
      >
        <Tab icon={<Folder />} iconPosition="start" label="My Library" />
        <Tab icon={<CloudUpload />} iconPosition="start" label="Upload Model" />
        <Tab icon={<Public />} iconPosition="start" label="Upload to Ion" />
        <Tab icon={<Add />} iconPosition="start" label="Add Ion Asset" />
      </Tabs>

      {/* Content */}
      <DialogContent
        sx={(theme) => ({
          padding: "24px",
          backgroundColor: theme.palette.background.default,
          overflow: "hidden",
          height: "500px",
          minHeight: "500px",
          maxHeight: "500px",
          display: "flex",
          flexDirection: "column",
        })}
      >
        {/* My Library Tab */}
        {activeTab === 0 && (
          <MyLibraryTab
            assets={userAssets}
            onAssetSelect={handleModelSelectWrapper}
            onAssetDelete={onAssetDelete}
            onAssetUpdate={onAssetUpdate}
            renderSupportiveData={renderSupportiveData}
          />
        )}

        {/* Upload Model Tab */}
        {activeTab === 1 && onCustomModelUpload && (
          <UploadModelTab
            onUpload={onCustomModelUpload}
            uploading={customModelUploading}
            uploadProgress={customModelUploadProgress}
          />
        )}

        {/* Upload to Ion Tab */}
        {activeTab === 2 && onCesiumIonUpload && (
          <UploadToIonTab
            onUpload={onCesiumIonUpload}
            uploading={ionUploading}
            uploadProgress={ionUploadProgress}
            integrations={[]}
          />
        )}

        {/* Add Ion Asset Tab */}
        {activeTab === 3 && onCesiumAssetAdd && (
          <AddIonAssetTab
            onAdd={onCesiumAssetAdd}
            onSuccess={onIonAssetAdded}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssetManagerModal;
