import { useCallback, useEffect, useState } from "react";
import { deleteJSON, fetchJSON, patchJSON, postJSON } from "../lib/api";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshBookmarks = useCallback(async (status) => {
    setLoading(true);
    try {
      const url = status ? `/api/bookmarks?status=${status}` : "/api/bookmarks";
      const payload = await fetchJSON(url);
      setBookmarks(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCollections = useCallback(async () => {
    try {
      const payload = await fetchJSON("/api/collections");
      setCollections(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setCollections([]);
    }
  }, []);

  const toggleBookmark = useCallback(async (sightingId, isCurrentlyBookmarked) => {
    if (isCurrentlyBookmarked) {
      await deleteJSON(`/api/bookmarks/${sightingId}`);
    } else {
      await postJSON("/api/bookmarks", { sighting_id: sightingId });
    }
  }, []);

  const updateBookmark = useCallback(async (sightingId, payload) => {
    return patchJSON(`/api/bookmarks/${sightingId}`, payload);
  }, []);

  const createCollection = useCallback(async (name, description) => {
    const result = await postJSON("/api/collections", { name, description });
    await refreshCollections();
    return result;
  }, [refreshCollections]);

  const addToCollection = useCallback(async (collectionId, sightingId) => {
    return postJSON(`/api/collections/${collectionId}/items`, { sighting_id: sightingId });
  }, []);

  const removeFromCollection = useCallback(async (collectionId, sightingId) => {
    return deleteJSON(`/api/collections/${collectionId}/items/${sightingId}`);
  }, []);

  useEffect(() => {
    refreshBookmarks();
    refreshCollections();
  }, [refreshBookmarks, refreshCollections]);

  return {
    bookmarks,
    collections,
    loading,
    refreshBookmarks,
    refreshCollections,
    toggleBookmark,
    updateBookmark,
    createCollection,
    addToCollection,
    removeFromCollection,
  };
}
