import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "../../lib/supabase";
import { API_BASE_URL } from "../../lib/installerAccess";
import { queueOfflineSubmission } from "../../lib/offlineQueue";
import {
  Camera,
  Video,
  Trash2,
  CheckCircle,
  ChevronLeft,
  Plus,
  ScanLine,
  Type as TypeIcon,
  X,
} from "lucide-react-native";

const MIN_PHOTOS = 3;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const isNew = id === "new";

  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isVerifyingSerial, setIsVerifyingSerial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("assigned");

  // New-installation (self-report) fields - only used when isNew
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobAddress, setNewJobAddress] = useState("");
  const [newFieldErrors, setNewFieldErrors] = useState<{ title?: string; address?: string }>({});

  // Site Form fields
  const [serialNo, setSerialNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [validatedProduct, setValidatedProduct] = useState<any>(null);
  const [serialError, setSerialError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Serial entry mode: typed (existing) or scanned (new)
  const [serialEntryMode, setSerialEntryMode] = useState<"type" | "scan">("type");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasScannedOnce, setHasScannedOnce] = useState(false);

  const fetchJobDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("installer_jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setJob(data);
      setStatus(data.status || "assigned");
      setSerialNo(data.serial_number || "");
      setRemarks(data.remarks || "");
      setPhotos(data.photos || []);

      if (data.notes && data.notes.includes("[METADATA]")) {
        const match = data.notes.match(/VIDEO:([^\s|]*)/);
        if (match && match[1]) {
          setVideoUrl(match[1]);
        }
      }
    } catch (err: any) {
      Alert.alert("Error", "Failed to fetch job details.");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isNew) fetchJobDetails();
  }, [id]);

  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  };

  const handleStartJob = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from("installer_jobs")
        .update({ status: "in_progress" })
        .eq("id", id);

      if (error) throw error;
      setStatus("in_progress");
      Alert.alert("Job Started", "The job status is now marked as In Progress.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySerial = async () => {
    if (!serialNo.trim()) {
      setValidatedProduct(null);
      setSerialError("Please enter a serial number.");
      return;
    }

    setIsVerifyingSerial(true);
    setSerialError("");
    setValidatedProduct(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setSerialError("Your session has expired. Please sign in again.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/installer/verify-serial`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serialNumber: serialNo.trim(), jobId: isNew ? undefined : id }),
      });
      const json = await res.json();

      // Fails closed - an unmatched or errored lookup is a real rejection,
      // never a fabricated "verified" result.
      if (!json.success || !json.product) {
        setValidatedProduct(null);
        setSerialError(json.error || "Serial number not found in inventory.");
        return;
      }

      setValidatedProduct(json.product);
    } catch (err: any) {
      setValidatedProduct(null);
      setSerialError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsVerifyingSerial(false);
    }
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert("Permission Denied", "Camera access is required to scan a barcode.");
        return;
      }
    }
    setHasScannedOnce(false);
    setIsScannerOpen(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScannedOnce) return; // debounce - CameraView fires repeatedly while a code stays in frame
    setHasScannedOnce(true);
    setIsScannerOpen(false);
    setSerialNo(data);
    setValidatedProduct(null);
    setSerialError("");
  };

  const uploadFileToStorage = async (uri: string, isVideo: boolean): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No active user session.");

    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = uri.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = isVideo ? `installer-videos/${fileName}` : `verification/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("job-photos")
      .upload(filePath, blob, {
        contentType: isVideo ? `video/${fileExt}` : `image/${fileExt}`,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: pUrl } = supabase.storage
      .from("job-photos")
      .getPublicUrl(filePath);

    return pUrl.publicUrl;
  };

  const handlePickPhoto = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Denied", "Camera/gallery access is required to upload photos.");
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
        });

    if (result.canceled) return;

    setIsUploadingPhoto(true);
    try {
      const publicUrl = await uploadFileToStorage(result.assets[0].uri, false);
      setPhotos((prev) => [...prev, publicUrl]);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickVideo = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Denied", "Access is required to record video.");
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.7,
        });

    if (result.canceled) return;

    setIsUploadingVideo(true);
    try {
      const publicUrl = await uploadFileToStorage(result.assets[0].uri, true);
      setVideoUrl(publicUrl);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload video.");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitProof = async () => {
    if (isNew) {
      const errs: { title?: string; address?: string } = {};
      if (!newJobTitle.trim()) errs.title = "Installation project title is required";
      if (!newJobAddress.trim()) errs.address = "Deployment site address is required";
      setNewFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    if (!serialNo.trim()) {
      Alert.alert("Validation Error", "Please fill in the Serial Number.");
      return;
    }
    if (!validatedProduct) {
      Alert.alert("Validation Error", "Please validate the Serial Number before submission.");
      return;
    }
    if (photos.length < MIN_PHOTOS) {
      Alert.alert(
        "Validation Error",
        `Please capture and upload at least ${MIN_PHOTOS} photo proofs (currently ${photos.length}).`
      );
      return;
    }
    if (!videoUrl) {
      Alert.alert("Validation Error", "A video of the installation is required.");
      return;
    }

    setIsSubmitting(true);
    const metadata = `[METADATA] SN:${serialNo.trim()} | VIDEO:${videoUrl} | REM:${remarks.trim()}`;
    const cleanNotes = isNew ? "" : (job?.notes || "").replace(/\[METADATA\][^\n]*\n?/g, "");
    const finalNotes = `${metadata}\n${cleanNotes}`;

    const payload = {
      job_title: isNew ? newJobTitle.trim() : job.job_title,
      address: isNew ? newJobAddress.trim() : job.address,
      serial_number: serialNo.trim(),
      remarks: remarks.trim(),
      photos,
      notes: finalNotes,
    };
    const siteFormJobId = isNew ? "new" : (id as string);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No active session");

      const res = await fetch(`${API_BASE_URL}/api/installer/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payload, siteFormJobId }),
      });
      const json = await res.json();

      if (!json.success) {
        Alert.alert("Submission Error", json.error || "Failed to submit job.");
        return;
      }

      Alert.alert(
        "Installation Submitted",
        "Your installation proof has been successfully uploaded and sent for approval.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      // Couldn't reach the server - save locally and retry automatically next
      // time the Jobs tab loads with a connection, mirroring the web page's
      // own localStorage fallback rather than losing the submission outright.
      await queueOfflineSubmission({ payload, siteFormJobId });
      Alert.alert(
        "Saved Locally",
        "No connection right now - this will be submitted automatically once you're back online.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00B4D8" />
      </View>
    );
  }

  const isEditable = isNew || status === "assigned" || status === "in_progress" || status === "rejected";
  const isRejected = !isNew && status === "rejected";
  const showSubmissionForm = isNew || status === "in_progress" || isRejected;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardContainer}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={16} color="#64748B" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {isNew ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>New Installation Record</Text>
            <Text style={styles.notesText}>
              Report an installation that wasn't assigned to you by an admin.
            </Text>

            <View style={[styles.formGroup, { marginTop: 12 }]}>
              <Text style={styles.formLabel}>Installation Project Title</Text>
              <TextInput
                value={newJobTitle}
                onChangeText={setNewJobTitle}
                placeholder="e.g. Al-Faisal Solar Project"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              {newFieldErrors.title ? <Text style={styles.errorText}>{newFieldErrors.title}</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Deployment Site Address</Text>
              <TextInput
                value={newJobAddress}
                onChangeText={setNewJobAddress}
                placeholder="Full site deployment address"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              {newFieldErrors.address ? <Text style={styles.errorText}>{newFieldErrors.address}</Text> : null}
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.card, isRejected && styles.cardRejected]}>
              <View style={styles.cardHeader}>
                <Text style={styles.jobTitle}>{job.job_title}</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        status === "approved"
                          ? "#ECFDF5"
                          : status === "pending_verification"
                          ? "#FFF7ED"
                          : status === "rejected"
                          ? "#FEE2E2"
                          : "#ECFEFF",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          status === "approved"
                            ? "#059669"
                            : status === "pending_verification"
                            ? "#EA580C"
                            : status === "rejected"
                            ? "#DC2626"
                            : "#0891B2",
                      },
                    ]}
                  >
                    {status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>

              {isRejected && job.verification_note && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionTitle}>Admin Feedback / Rejection Note:</Text>
                  <Text style={styles.rejectionText}>{job.verification_note}</Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Client Address:</Text>
                <Text style={styles.metaValue}>{job.address}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Assigned Incentive:</Text>
                <Text style={[styles.metaValue, { color: "#059669", fontWeight: "bold" }]}>
                  PKR {job.incentive || 5000}
                </Text>
              </View>
            </View>

            {job.notes && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Client Instructions & Notes</Text>
                <Text style={styles.notesText}>
                  {job.notes.replace(/\[METADATA\][^\n]*\n?/g, "") || "No special instructions registered."}
                </Text>
              </View>
            )}

            {status === "assigned" && (
              <TouchableOpacity onPress={handleStartJob} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start Job (In Progress)</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {showSubmissionForm && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Submit Installation Proof</Text>

            {/* Serial Number & Verification */}
            <View style={styles.formGroup}>
              <View style={styles.serialHeaderRow}>
                <Text style={styles.formLabel}>Product Serial Number</Text>
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    onPress={() => setSerialEntryMode("type")}
                    style={[styles.modeButton, serialEntryMode === "type" && styles.modeButtonActive]}
                  >
                    <TypeIcon size={12} color={serialEntryMode === "type" ? "#FFFFFF" : "#64748B"} />
                    <Text style={[styles.modeButtonText, serialEntryMode === "type" && styles.modeButtonTextActive]}>
                      Type
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSerialEntryMode("scan")}
                    style={[styles.modeButton, serialEntryMode === "scan" && styles.modeButtonActive]}
                  >
                    <ScanLine size={12} color={serialEntryMode === "scan" ? "#FFFFFF" : "#64748B"} />
                    <Text style={[styles.modeButtonText, serialEntryMode === "scan" && styles.modeButtonTextActive]}>
                      Scan
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {serialEntryMode === "scan" && (
                <TouchableOpacity onPress={openScanner} style={styles.scanButton}>
                  <ScanLine size={18} color="#00B4D8" />
                  <Text style={styles.scanButtonText}>
                    {serialNo ? "Scan Again" : "Open Barcode Scanner"}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.verifyRow}>
                <TextInput
                  value={serialNo}
                  onChangeText={(txt) => {
                    setSerialNo(txt);
                    setValidatedProduct(null);
                    setSerialError("");
                  }}
                  editable={serialEntryMode === "type"}
                  placeholder="e.g. CTNX-8kW-XXXXX"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  style={[styles.input, serialEntryMode === "scan" && styles.inputReadOnly]}
                />
                <TouchableOpacity
                  onPress={handleVerifySerial}
                  disabled={isVerifyingSerial}
                  style={styles.verifyButton}
                >
                  {isVerifyingSerial ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>

              {validatedProduct && (
                <View style={styles.validProductBox}>
                  <Text style={styles.validProductTitle}>✓ Serial Number Validated</Text>
                  <Text style={styles.validProductText}>
                    Product: {validatedProduct.product_name} ({validatedProduct.model})
                  </Text>
                  <Text style={styles.validProductText}>
                    Warehouse: {validatedProduct.warehouse_name}
                  </Text>
                </View>
              )}

              {serialError ? <Text style={styles.errorText}>{serialError}</Text> : null}
            </View>

            {/* Photos Upload */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Installation Photos (Evidence) - minimum {MIN_PHOTOS}
              </Text>

              <View style={styles.photoUploadRow}>
                <TouchableOpacity
                  onPress={() => handlePickPhoto(true)}
                  disabled={isUploadingPhoto}
                  style={styles.mediaPickerButton}
                >
                  <Camera size={18} color="#00B4D8" />
                  <Text style={styles.mediaPickerText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePickPhoto(false)}
                  disabled={isUploadingPhoto}
                  style={styles.mediaPickerButton}
                >
                  <Plus size={18} color="#00B4D8" />
                  <Text style={styles.mediaPickerText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {isUploadingPhoto && (
                <View style={styles.loaderRow}>
                  <ActivityIndicator size="small" color="#00B4D8" />
                  <Text style={styles.loaderText}>Uploading image...</Text>
                </View>
              )}

              <View style={styles.photoGrid}>
                {photos.map((url, idx) => (
                  <View key={idx} style={styles.photoWrapper}>
                    <Image source={{ uri: url }} style={styles.photoThumbnail} />
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(idx)}
                      style={styles.removePhotoBadge}
                    >
                      <Trash2 size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Video Upload */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Verification Video (Required)</Text>

              <View style={styles.photoUploadRow}>
                <TouchableOpacity
                  onPress={() => handlePickVideo(true)}
                  disabled={isUploadingVideo}
                  style={styles.mediaPickerButton}
                >
                  <Video size={18} color="#00B4D8" />
                  <Text style={styles.mediaPickerText}>Record</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePickVideo(false)}
                  disabled={isUploadingVideo}
                  style={styles.mediaPickerButton}
                >
                  <Plus size={18} color="#00B4D8" />
                  <Text style={styles.mediaPickerText}>Library</Text>
                </TouchableOpacity>
              </View>

              {isUploadingVideo && (
                <View style={styles.loaderRow}>
                  <ActivityIndicator size="small" color="#00B4D8" />
                  <Text style={styles.loaderText}>Uploading video...</Text>
                </View>
              )}

              {videoUrl ? (
                <View style={styles.videoStatusBox}>
                  <Text style={styles.videoStatusText} numberOfLines={1}>
                    ✓ Video proof linked: {videoUrl.split("/").pop()}
                  </Text>
                  <TouchableOpacity onPress={() => setVideoUrl("")} style={styles.removeVideoBtn}>
                    <Text style={styles.removeVideoText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* Remarks */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Installation Remarks (Optional)</Text>
              <TextInput
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Describe any issues, installation status, or special notes..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 8 }]}
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmitProof}
              disabled={isSubmitting}
              style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <CheckCircle size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>
                    {isNew ? "Submit New Installation" : "Submit Verification Proof"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!isNew && !isEditable && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Submitted Proof Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Serial Number:</Text>
              <Text style={styles.metaValue}>{job.serial_number || "-"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Remarks:</Text>
              <Text style={styles.metaValue}>{job.remarks || "No remarks entered."}</Text>
            </View>

            {photos.length > 0 && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Uploaded Proof Photos:</Text>
                <View style={styles.photoGrid}>
                  {photos.map((url, idx) => (
                    <Image key={idx} source={{ uri: url }} style={styles.photoThumbnail} />
                  ))}
                </View>
              </View>
            )}

            {videoUrl ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Video Proof Link:</Text>
                <Text style={[styles.metaValue, { color: "#00B4D8" }]} numberOfLines={1}>
                  {videoUrl}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={isScannerOpen} animationType="slide" onRequestClose={() => setIsScannerOpen(false)}>
        <View style={styles.scannerContainer}>
          {cameraPermission?.granted && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "ean13", "code128", "code39", "upc_a", "upc_e"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerHint}>Align the barcode within the frame</Text>
          </View>
          <TouchableOpacity onPress={() => setIsScannerOpen(false)} style={styles.scannerCloseButton}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRejected: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  rejectionBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
    marginBottom: 12,
  },
  rejectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#991B1B",
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 11,
    color: "#7F1D1D",
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaColumn: {
    flexDirection: "column",
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "bold",
  },
  metaValue: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    paddingLeft: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  notesText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  primaryButton: {
    height: 44,
    backgroundColor: "#00B4D8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 6,
  },
  serialHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  modeButtonActive: {
    backgroundColor: "#00B4D8",
  },
  modeButtonText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  scanButton: {
    height: 40,
    borderWidth: 1.5,
    borderColor: "#00B4D8",
    borderStyle: "dashed",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  input: {
    height: 44,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#1E293B",
  },
  inputReadOnly: {
    backgroundColor: "#F8FAFC",
    color: "#64748B",
  },
  verifyRow: {
    flexDirection: "row",
    gap: 8,
  },
  verifyButton: {
    width: 80,
    backgroundColor: "#1E293B",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  validProductBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  validProductTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#065F46",
    marginBottom: 4,
  },
  validProductText: {
    fontSize: 10,
    color: "#047857",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 10,
    marginTop: 4,
    fontWeight: "bold",
  },
  photoUploadRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  mediaPickerButton: {
    flex: 1,
    height: 40,
    borderWidth: 1.5,
    borderColor: "#00B4D8",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mediaPickerText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00B4D8",
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  loaderText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "bold",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  photoWrapper: {
    position: "relative",
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  removePhotoBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  videoStatusBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FAFE",
    borderWidth: 1,
    borderColor: "#BDE6F6",
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  videoStatusText: {
    fontSize: 11,
    color: "#0284C7",
    fontWeight: "bold",
    flex: 1,
    marginRight: 12,
  },
  removeVideoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
  },
  removeVideoText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "bold",
  },
  submitButton: {
    height: 48,
    backgroundColor: "#059669",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: "#00B4D8",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scannerHint: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 16,
  },
  scannerCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
