/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Initialize Firebase Admin
const app = initializeApp();
const db = getFirestore(app);

// Set global options for cost control
setGlobalOptions({ maxInstances: 5 });

// Video compression settings (AGGRESSIVE - optimized for speed)
const COMPRESSION_SETTINGS = {
  videoBitrate: "1500k",    // Reduced from 2500k for faster processing
  audioCodec: "aac",        // AAC audio
  videoCodec: "libx264",    // H.264 video
  format: "mp4",            // MP4 format
  fps: 30,                  // 30 fps max
  maxWidth: 960,            // NEW: Max width instead of fixed scale
  maxHeight: 960,           // NEW: Max height instead of fixed scale
  crf: 28,                  // Increased from 25 (faster encoding, smaller files)
};

// File size thresholds
const MIN_SIZE_TO_COMPRESS = 3 * 1024 * 1024; // 3MB - only compress files larger than this

// Video file extensions to process
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'];

/**
 * Test function to verify Firestore access
 */
async function testFirestoreAccess() {
  try {
    logger.info("🔍 Testing Firestore access...");
    const testCollection = db.collection('businesses');
    const snapshot = await testCollection.limit(1).get();
    logger.info("✅ Firestore access successful, found documents:", snapshot.size);
    return true;
  } catch (error) {
    logger.error("❌ Firestore access failed:", error.message);
    return false;
  }
}

/**
 * Compress video using FFmpeg with optimized settings
 */
function compressVideoWithFFmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec(COMPRESSION_SETTINGS.videoCodec)
      .audioCodec(COMPRESSION_SETTINGS.audioCodec)
      .videoBitrate(COMPRESSION_SETTINGS.videoBitrate)
      .fps(COMPRESSION_SETTINGS.fps)
      .addOptions([
        `-crf ${COMPRESSION_SETTINGS.crf}`,
        '-movflags +faststart',
        '-preset fast',
        `-vf scale='min(${COMPRESSION_SETTINGS.maxWidth},iw)':min'(${COMPRESSION_SETTINGS.maxHeight},ih)':force_original_aspect_ratio=decrease`
      ])
      .format(COMPRESSION_SETTINGS.format)
      .on('start', (commandLine) => {
        logger.info('FFmpeg started:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          logger.info(`Compression progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        logger.info('FFmpeg compression completed');
        resolve();
      })
      .on('error', (err) => {
        logger.error('FFmpeg error:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Cloud Function that automatically compresses event videos uploaded to Firebase Storage
 * Targets files uploaded to events/ folder in australia-southeast1 region
 */
exports.processAustraliaEventVideo = onObjectFinalized({
  region: "australia-southeast1",
  memory: "2GiB",
  timeoutSeconds: 540, // 9 minutes max
}, async (event) => {
  const filePath = event.data.name;
  const contentType = event.data.contentType;
  const bucket = getStorage().bucket(event.data.bucket);
  
  logger.info("Processing uploaded file:", { filePath, contentType });

  // Test Firestore access first
  const firestoreWorking = await testFirestoreAccess();
  if (!firestoreWorking) {
    logger.error("❌ Cannot access Firestore, skipping function");
    return;
  }

  // Early exits - don't process if not needed
  if (!filePath) {
    logger.info("No file path, skipping");
    return;
  }

  // Only process files in events/ folder
  if (!filePath.startsWith("events/")) {
    logger.info("Not in events folder, skipping:", { filePath });
    return;
  }

  // Skip if not a video file
  const fileExtension = path.extname(filePath).toLowerCase();
  if (!VIDEO_EXTENSIONS.includes(fileExtension)) {
    logger.info("Not a video file, skipping:", { fileExtension });
    return;
  }

  // Skip if already compressed (has _compressed suffix)
  if (filePath.includes("_compressed")) {
    logger.info("Already compressed, skipping:", { filePath });
    return;
  }
  
  // Additional debug logging
  logger.info("File passed compression check:", { 
    filePath, 
    containsCompressed: filePath.includes("_compressed"),
    fileExtension 
  });

  // Skip if file is too small to need compression
  const file = bucket.file(filePath);
  
  // NEW: Additional safety check and get metadata
  let metadata;
  try {
    [metadata] = await file.getMetadata();
    if (metadata.metadata && metadata.metadata.compressedBy === "processAustraliaEventVideo") {
      logger.info("File created by compression function, skipping:", { filePath });
      return;
    }
  } catch (_metadataError) {
    // Metadata check failed, continue with processing
    logger.warn("Failed to get metadata for safety check:", _metadataError.message);
    [metadata] = await file.getMetadata(); // Fallback metadata call
  }

  const fileSize = parseInt(metadata.size);
  
  if (fileSize < MIN_SIZE_TO_COMPRESS) {
    logger.info("File too small to compress:", { fileSize, threshold: MIN_SIZE_TO_COMPRESS });
    return;
  }

  logger.info("Starting video compression:", { 
    filePath, 
    originalSize: fileSize,
    sizeInMB: (fileSize / 1024 / 1024).toFixed(2) + "MB"
  });

  // Create temporary file paths
  const tempDir = os.tmpdir();
  const tempInputPath = path.join(tempDir, `input_${Date.now()}${fileExtension}`);
  const tempOutputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

  try {
    // Download the original video
    logger.info("Downloading original video...");
    await file.download({ destination: tempInputPath });
    
    // Compress the video using FFmpeg
    logger.info("Starting FFmpeg compression...");
    await compressVideoWithFFmpeg(tempInputPath, tempOutputPath);
    
    // Check if compression was successful and beneficial
    const compressedStats = fs.statSync(tempOutputPath);
    const compressedSize = compressedStats.size;
    
    logger.info("Compression complete:", { 
      originalSize: fileSize, 
      compressedSize: compressedSize,
      reduction: ((fileSize - compressedSize) / fileSize * 100).toFixed(1) + "%"
    });

    // Only upload if compression actually reduced file size significantly
    if (compressedSize < fileSize * 0.9) { // At least 10% reduction
      // Create compressed filename (don't overwrite original)
      const originalName = path.parse(filePath).name;
      const compressedFilePath = `events/${originalName}_compressed.mp4`;
      
      logger.info("Uploading compressed video to new location...");
      await bucket.upload(tempOutputPath, {
        destination: compressedFilePath,
        metadata: {
          contentType: "video/mp4",
          metadata: {
            compressed: "true",
            originalFile: filePath,
            originalSize: fileSize.toString(),
            compressedSize: compressedSize.toString(),
            compressionDate: new Date().toISOString(),
            compressedBy: "processAustraliaEventVideo"
          }
        }
      });
      
      logger.info("Event video compression successful:", {
        originalFile: filePath,
        compressedFile: compressedFilePath,
        originalSize: fileSize,
        compressedSize: compressedSize,
        savedBytes: fileSize - compressedSize
      });
      
      // Move pending event to live events with compressed URL
      const compressedUrl = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/events%2F${originalName}_compressed.mp4?alt=media`;
      
      // STEP 1: Query pending events (with individual error handling)
      let pendingEventDoc = null;
      let pendingEventData = null;
      
      try {
        logger.info("🔍 STEP 1: Attempting to query pending-events collection...");
        const pendingEventsRef = db.collection('pending-events');
        const allPendingEvents = await pendingEventsRef.get();
        
        logger.info("✅ STEP 1: Successfully queried pending-events collection:", {
          totalPendingEvents: allPendingEvents.docs.length
        });
        
        // Find the pending event with video URL containing our original filename
        const originalFileName = `${originalName}.${path.extname(filePath).substring(1)}`;
        
        for (const doc of allPendingEvents.docs) {
          const data = doc.data();
          if (data.video && data.video.includes(originalFileName)) {
            pendingEventDoc = doc;
            pendingEventData = data;
            break;
          }
        }
        
        if (pendingEventDoc) {
          logger.info("✅ STEP 1: Found matching pending event:", {
            eventId: pendingEventDoc.id,
            originalFileName: originalFileName,
            videoUrl: pendingEventData.video
          });
        } else {
          logger.info("❌ STEP 1: No pending event found for video filename:", {
            originalFileName: originalFileName,
            searchedInPendingEvents: allPendingEvents.docs.length
          });
          return; // Exit early if no pending event found
        }
      } catch (queryError) {
        logger.error("❌ STEP 1: Failed to query pending-events collection:", {
          error: queryError.message,
          code: queryError.code,
          stack: queryError.stack
        });
        return; // Exit early if query fails
      }
      
      // STEP 2: Write to events collection (with individual error handling)
      let liveEventCreated = false;
      try {
        logger.info("📝 STEP 2: Attempting to write to events collection...");
        
        // Create the live event with compressed video URL
        const eventData = {
          ...pendingEventData,
          video: compressedUrl,
          updatedAt: new Date().toISOString()
        };
        
        // Remove image field if it exists (this is a video event)
        delete eventData.image;
        
        await db.collection('events').doc(pendingEventDoc.id).set(eventData);
        liveEventCreated = true; // Mark as successfully created
        
        logger.info("✅ STEP 2: Successfully wrote to events collection:", {
          eventId: pendingEventDoc.id,
          compressedUrl: compressedUrl
        });
      } catch (writeError) {
        logger.error("❌ STEP 2: Failed to write to events collection:", {
          error: writeError.message,
          code: writeError.code,
          eventId: pendingEventDoc.id,
          stack: writeError.stack
        });
        return; // Exit early if write fails - don't delete anything
      }
      
      // STEP 3: Delete from pending events (only if live event was created)
      if (liveEventCreated) {
        try {
          logger.info("🗑️ STEP 3: Attempting to delete from pending-events collection...");
          
          await pendingEventDoc.ref.delete();
          
          logger.info("✅ STEP 3: Successfully deleted from pending-events collection:", {
            eventId: pendingEventDoc.id
          });
          
          // STEP 4: Delete original file ONLY after both live creation AND pending deletion succeed
          try {
            logger.info("🗑️ STEP 4: Deleting original large file after successful live event creation:", filePath);
            await bucket.file(filePath).delete();
            logger.info("✅ STEP 4: Original file deleted successfully - live event active, pending event cleaned up:", filePath);
          } catch (deleteError) {
            logger.warn("⚠️ STEP 4: Failed to delete original file (not critical - live event created successfully):", {
              filePath,
              error: deleteError.message
            });
          }
          
          logger.info("🎉 ALL STEPS COMPLETED: Event moved from pending to live, original file cleaned up:", {
            eventId: pendingEventDoc.id,
            compressedUrl: compressedUrl
          });
          
        } catch (deleteError) {
          logger.error("❌ STEP 3: Failed to delete from pending-events collection:", {
            error: deleteError.message,
            code: deleteError.code,
            eventId: pendingEventDoc.id,
            stack: deleteError.stack
          });
          
          logger.warn("⚠️ Not deleting original file because pending event cleanup failed - keeping for safety");
        }
      }
    } else {
      logger.info("Compression not beneficial, keeping original:", {
        originalSize: fileSize,
        compressedSize: compressedSize
      });
      
      // Since compression wasn't beneficial, we can safely delete the original
      // as it's not providing value over keeping the smaller "compressed" version
      try {
        logger.info("Deleting original file since compression wasn't beneficial:", filePath);
        await bucket.file(filePath).delete();
        logger.info("✅ Original file deleted (compression not beneficial):", filePath);
      } catch (deleteError) {
        logger.warn("⚠️ Failed to delete original file:", {
          filePath,
          error: deleteError.message
        });
      }
    }

  } catch (error) {
    logger.error("Error during video compression process:", {
      error: error.message,
      stack: error.stack,
      filePath: filePath
    });
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
        logger.info("Cleaned up temp input file");
      }
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
        logger.info("Cleaned up temp output file");
      }
    } catch (cleanupError) {
      logger.warn("Error cleaning up temp files:", cleanupError.message);
    }
  }
});