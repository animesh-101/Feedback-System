import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FeedbackPeriod, Department } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { ClipboardCheck, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';

const AvailableFeedbacks: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [feedbackPeriods, setFeedbackPeriods] = useState<FeedbackPeriod[]>([]);
  const [submittedDepartments, setSubmittedDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const fetchAvailableFeedbacks = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        console.log('Current user:', currentUser);
        
        // Current timestamp for comparison
        const now = Timestamp.now();
        console.log('Current timestamp:', now.toDate());
        
        // Get active feedback periods for departments other than the user's
        const periodsQuery = query(
          collection(db, 'feedbackPeriods'),
          where('active', '==', true),
          where('endDate', '>', now),
          orderBy('endDate', 'asc')  // Add ordering to make the query more efficient
        );
        
        console.log('Fetching feedback periods with query:', {
          active: true,
          endDate: now.toDate()
        });
        
        const periodsSnapshot = await getDocs(periodsQuery);
        console.log('Total feedback periods found:', periodsSnapshot.size);
        
        const periods: FeedbackPeriod[] = [];
        periodsSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Feedback period data:', {
            id: doc.id,
            department: data.department,
            userDepartment: currentUser.department,
            isActive: data.active,
            endDate: data.endDate.toDate(),
            questions: data.questions.length
          });
          
          // Only show feedback forms for other departments
          if (data.department !== currentUser.department) {
            periods.push({
              id: doc.id,
              department: data.department,
              startDate: data.startDate.toDate(),
              endDate: data.endDate.toDate(),
              questions: data.questions,
              active: data.active
            });
          }
        });
        
        console.log('Filtered feedback periods:', periods.length);
        
        // Get departments for which the user has already submitted feedback
        const submittedQuery = query(
          collection(db, 'feedbacks'),
          where('userId', '==', currentUser.uid)
        );
        
        const submittedSnapshot = await getDocs(submittedQuery);
        console.log('User submitted feedbacks:', submittedSnapshot.size);
        
        const submitted: Department[] = [];
        submittedSnapshot.forEach((doc) => {
          const data = doc.data();
          submitted.push(data.targetDepartment);
        });
        
        console.log('Submitted departments:', submitted);
        
        setFeedbackPeriods(periods);
        setSubmittedDepartments(submitted);
      } catch (error) {
        console.error('Error fetching available feedbacks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableFeedbacks();
  }, [currentUser]);

  const handleStartFeedback = (periodId: string, department: Department) => {
    navigate(`/feedback/${periodId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const availablePeriods = feedbackPeriods.filter(
    period => !submittedDepartments.includes(period.department)
  );

  return (
    <div className="animate-appear">
      <h2 className="text-2xl font-semibold mb-6 text-neutral-800">Available Feedback Forms</h2>
      
      {availablePeriods.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="flex justify-center mb-4">
            <ClipboardCheck size={48} className="text-neutral-400" />
          </div>
          <h3 className="text-xl font-medium text-neutral-600 mb-2">No Feedback Forms Available</h3>
          <p className="text-neutral-500">
            You've completed all available feedback forms or there are no active feedback forms at the moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availablePeriods.map((period) => (
            <div key={period.id} className="card hover:shadow-md transition-shadow duration-200">
              <div className="card-body">
                <div className="flex items-center space-x-2 mb-4">
                  <Building2 size={20} className="text-primary-500" />
                  <h3 className="text-lg font-semibold text-primary-700">{period.department} Department</h3>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-start space-x-2 text-sm">
                    <Calendar size={16} className="text-neutral-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-neutral-600">Available until:</p>
                      <p className="font-medium">{format(period.endDate, 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-neutral-600">
                    {period.questions.length} question{period.questions.length !== 1 ? 's' : ''} to answer
                  </p>
                </div>
                
                <button
                  onClick={() => handleStartFeedback(period.id, period.department)}
                  className="btn btn-primary w-full"
                >
                  Start Feedback
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {submittedDepartments.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4 text-neutral-700">Completed Feedbacks</h3>
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {submittedDepartments.map((dept) => (
                <div key={dept} className="flex items-center space-x-2 p-3 bg-success-50 rounded-md border border-success-100">
                  <ClipboardCheck size={18} className="text-success-500" />
                  <span className="text-neutral-700">{dept} Department</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailableFeedbacks;