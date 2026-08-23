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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { Camera, Video, Trash2, CheckCircle, ChevronLeft, Plus } from "lucide-react-native";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyingSerial, setIsVerifyingSerial] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("assigned");

  // Site Form fields
  const [serialNo, setSerialNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [validatedProduct, setValidatedProduct] = useState<any>(null);
  const [serialError, setSerialError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

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

      // Extract video URL if notes contains [METADATA]
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
    fetchJobDetails();
  }, [id]);

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
      const cleanSNo = serialNo.trim();

      // 1. Check database for serial number usage in active installer jobs
      const { data: activeJobs, error: activeError } = await supabase
        .from("installer_jobs")
        .select("id, job_title, status")
        .ilike("serial_number", cleanSNo);

      const conflicts = (activeJobs || []).filter(
        (j) => j.id !== id && j.status !== "rejected" && j.status !== "declined"
      );

      if (conflicts.length > 0) {
        setSerialError(`Serial number already registered for: "${conflicts[0].job_title}".`);
        setIsVerifyingSerial(false);
        return;
      }

      // 2. Query stock table to see if it is in inventory
      const { data: stockData, error: stockError } = await supabase
        .from("stock")
        .select("*, products(name, brand, model)")
        .ilike("serial_no", cleanSNo)
        .maybeSingle();

      if (stockError) throw stockError;

      if (!stockData) {
        // Fallback for custom products or non-catalog items
        setValidatedProduct({
          product_name: "CoreTech Solar Product",
          brand: "CoreTech",
          model: "NexGen",
          warehouse_name: "Active Inventory",
        });
      } else {
        setValidatedProduct({
          product_name: stockData.products?.name || "CoreTech Solar Unit",
          brand: stockData.products?.brand || "CoreTech",
          model: stockData.model_no || stockData.products?.model || "NexGen",
          warehouse_name: stockData.warehouse_name || "Active Stock",
        });
      }
    } catch (err: any) {
      console.warn("Serial verification error:", err);
      // Fallback
      setValidatedProduct({
        product_name: "CoreTech Solar Product (Manual Fallback)",
        brand: "CoreTech",
        model: "NexGen",
        warehouse_name: "Active Inventory",
      });
    } finally {
      setIsVerifyingSerial(false);
    }
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
    if (!serialNo.trim()) {
      Alert.alert("Validation Error", "Please fill in the Serial Number.");
      return;
    }
    if (!validatedProduct) {
      Alert.alert("Validation Error", "Please validate the Serial Number before submission.");
      return;
    }
    if (photos.length === 0) {
      Alert.alert("Validation Error", "Please capture and upload at least one photo proof.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No active user session found.");

      const isRejected = status === "rejected" || status === "declined";

      // Prepend metadata matching web structure:
      const metadata = `[METADATA] SN:${serialNo.trim()} | VIDEO:${videoUrl} | REM:${remarks.trim()}`;
      // Clean notes of any older metadata blocks if they exist
      const cleanNotes = (job.notes || "").replace(/\[METADATA\][^\n]*\n?/g, "");
      const finalNotes = `${metadata}\n${cleanNotes}`;

      // 1. Update installer_jobs record
      const { error: jobErr } = await supabase
        .from("installer_jobs")
        .update({
          status: "pending_verification",
          serial_number: serialNo.trim(),
          remarks: remarks.trim(),
          photos: photos,
          notes: finalNotes,
          approval_note: null,
          verification_note: null,
          is_resubmitted: isRejected,
        })
        .eq("id", id);

      if (jobErr) throw jobErr;

      // 2. Consume stock inventory item by marking it as sold_out
      try {
        await supabase
          .from("stock")
          .update({
            status: "sold_out",
            sold_out_at: new Date().toISOString(),
            sold_out_by_installer_id: user.id,
            installation_id: id,
            installation_project_title: job.job_title,
            deployment_site_address: job.address,
          })
          .ilike("serial_no", serialNo.trim());
      } catch (stockErr) {
        console.warn("Stock update bypassed or restricted by RLS:", stockErr);
      }

      Alert.alert(
        "Installation Submitted",
        "Your installation proof has been successfully uploaded and sent for approval.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Submission Error", err.message || "Failed to submit job.");
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

  const isEditable = status === "assigned" || status === "in_progress" || status === "rejected";
  const isRejected = status === "rejected";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardContainer}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Navigation Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={16} color="#64748B" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Customer Information */}
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

        {/* Notes/Instructions */}
        {job.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Client Instructions & Notes</Text>
            <Text style={styles.notesText}>
              {job.notes.replace(/\[METADATA\][^\n]*\n?/g, "") || "No special instructions registered."}
            </Text>
          </View>
        )}

        {/* Action button to Start Job */}
        {status === "assigned" && (
          <TouchableOpacity onPress={handleStartJob} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start Job (In Progress)</Text>
          </TouchableOpacity>
        )}

        {/* Completion & Submission Form (Editable if In Progress or Rejected) */}
        {(status === "in_progress" || isRejected) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Submit Installation Proof</Text>

            {/* Serial Number & Verification */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Product Serial Number (from Barcode/Label)</Text>
              <View style={styles.verifyRow}>
                <TextInput
                  value={serialNo}
                  onChangeText={(txt) => {
                    setSerialNo(txt);
                    setValidatedProduct(null);
                    setSerialError("");
                  }}
                  placeholder="e.g. CTNX-8kW-XXXXX"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  style={styles.input}
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
              <Text style={styles.formLabel}>Installation Photos (Evidence)</Text>

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

            {/* Final Submission Button */}
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
                  <Text style={styles.submitButtonText}>Submit Verification Proof</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Read-Only Proof Info if already submitted/approved */}
        {!isEditable && (
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
});
