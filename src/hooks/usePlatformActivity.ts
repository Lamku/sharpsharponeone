import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  DocumentData,
  QuerySnapshot
} from "firebase/firestore";

interface Activity {
  id: string;
  user_id: string;
  type: string;
  description: string;
  amount?: number;
  created_at: any;
  user?: {
    full_name: string;
    phone: string;
  };
}

export function usePlatformActivity(limitCount: number = 20) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // Query for recent activities (transactions, investments, etc.)
    const q = query(
      collection(db, 'transactions'),
      orderBy('created_at', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot: QuerySnapshot<DocumentData>) => {
        try {
          const activitiesData: Activity[] = [];
          
          // Process each transaction
          for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Fetch user details for each activity
            let userName = 'Unknown User';
            let userPhone = '';
            
            if (data.user_id) {
              try {
                const userDoc = await import('firebase/firestore').then(({ getDoc, doc: firestoreDoc }) => 
                  getDoc(firestoreDoc(db, 'users', data.user_id))
                );
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  userName = userData.full_name || 'Unknown User';
                  userPhone = userData.phone || '';
                }
              } catch (err) {
                console.error('Error fetching user:', err);
              }
            }
            
            activitiesData.push({
              id: doc.id,
              user_id: data.user_id || '',
              type: data.type || 'transaction',
              description: data.description || 'Transaction',
              amount: data.amount || 0,
              created_at: data.created_at,
              user: {
                full_name: userName,
                phone: userPhone
              }
            });
          }
          
          setActivities(activitiesData);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('Error processing activities:', err);
          setError('Failed to load activities');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to activities:', err);
        setError('Failed to load activities');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [limitCount]);

  return { activities, loading, error };
}