import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { addDoc, collection, getDocs, updateDoc, doc, Timestamp, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Department, departments, FeedbackPeriod, Question } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { PlusCircle, Trash2, Save, Clock, Calendar, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface QuestionTemplate {
  department: Department;
  questions: string[];
}

interface FeedbackFormData {
  department: Department;
  startDate: string;
  endDate: string;
  questions: {
    text: string;
    id?: string;
  }[];
}

const FeedbackQuestionManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackPeriods, setFeedbackPeriods] = useState<FeedbackPeriod[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FeedbackFormData>({
    defaultValues: {
      department: departments[0],
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      questions: [{ text: '' }]
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions'
  });
  
  const selectedDepartment = watch('department');

  const loadTemplateQuestions = async () => {
    try {
      const templatesRef = collection(db, 'questionTemplates');
      const q = query(templatesRef, where('department', '==', selectedDepartment));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const template = querySnapshot.docs[0].data() as QuestionTemplate;
        const questions = template.questions.map((text: string) => ({ text }));
        setValue('questions', questions);
      } else {
        setError('No template found for this department');
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template questions');
    }
  };
  
  // Fetch existing feedback periods
  useEffect(() => {
    const fetchFeedbackPeriods = async () => {
      setLoading(true);
      try {
        const periodsRef = collection(db, 'feedbackPeriods');
        const periodsSnapshot = await getDocs(periodsRef);
        
        const periods: FeedbackPeriod[] = [];
        periodsSnapshot.forEach((doc) => {
          const data = doc.data();
          periods.push({
            id: doc.id,
            department: data.department,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            questions: data.questions,
            active: data.active
          });
        });
        
        setFeedbackPeriods(periods);
      } catch (error) {
        console.error('Error fetching feedback periods:', error);
        setError('Failed to load feedback periods');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFeedbackPeriods();
  }, []);
  
  const onSubmit = async (data: FeedbackFormData) => {
    if (data.questions.some(q => !q.text.trim())) {
      setError('All questions must have text');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('Starting feedback period creation with data:', data);
      
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      
      if (startDate > endDate) {
        setError('End date must be after start date');
        setSubmitting(false);
        return;
      }
      
      // Format questions
      const questions: Question[] = data.questions.map((q, index) => ({
        id: q.id || `question_${Date.now()}_${index}`,
        text: q.text.trim(),
        department: data.department
      }));
      
      console.log('Formatted questions:', questions);
      
      // Create new feedback period
      const feedbackPeriodData = {
        department: data.department,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        questions,
        active: true,
        createdAt: Timestamp.now()
      };
      
      console.log('Creating feedback period in Firestore:', feedbackPeriodData);
      
      const docRef = await addDoc(collection(db, 'feedbackPeriods'), feedbackPeriodData);
      console.log('Feedback period created successfully with ID:', docRef.id);
      
      // Refresh the periods list
      const periodsRef = collection(db, 'feedbackPeriods');
      const periodsSnapshot = await getDocs(periodsRef);
      
      console.log('Total feedback periods after creation:', periodsSnapshot.size);
      
      const periods: FeedbackPeriod[] = [];
      periodsSnapshot.forEach((doc) => {
        const data = doc.data();
        periods.push({
          id: doc.id,
          department: data.department,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          questions: data.questions,
          active: data.active
        });
      });
      
      setFeedbackPeriods(periods);
      
      // Reset form
      reset({
        department: data.department,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        questions: [{ text: '' }]
      });
      
      setSuccess('Feedback period created successfully');
    } catch (err) {
      console.error('Error creating feedback period:', err);
      setError('Failed to create feedback period');
    } finally {
      setSubmitting(false);
    }
  };
  
  const toggleActive = async (periodId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'feedbackPeriods', periodId), {
        active: !currentActive
      });
      
      // Update local state
      setFeedbackPeriods(prev => 
        prev.map(period => 
          period.id === periodId 
            ? { ...period, active: !currentActive } 
            : period
        )
      );
      
      setSuccess(`Feedback period ${!currentActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error('Error toggling feedback period:', err);
      setError('Failed to update feedback period');
    }
  };
  
  const deletePeriod = async (periodId: string) => {
    if (!confirm('Are you sure you want to delete this feedback period? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'feedbackPeriods', periodId));
      
      // Update local state
      setFeedbackPeriods(prev => prev.filter(period => period.id !== periodId));
      
      setSuccess('Feedback period deleted successfully');
    } catch (err) {
      console.error('Error deleting feedback period:', err);
      setError('Failed to delete feedback period');
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-neutral-800 mb-6">
        Manage Feedback Questions
      </h3>
      
      {success && (
        <div className="mb-6 p-3 bg-success-50 text-success-600 rounded-md animate-appear flex items-center">
          <Save size={18} className="mr-2" />
          {success}
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-3 bg-error-50 text-error-600 rounded-md animate-appear flex items-center">
          <AlertTriangle size={18} className="mr-2" />
          {error}
        </div>
      )}
      
      <div className="card mb-8">
        <div className="card-header">
          <h4 className="font-medium text-neutral-800">Create New Feedback Period</h4>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="form-control">
                <label htmlFor="department" className="form-label">Department</label>
                <select
                  id="department"
                  className={`form-select ${errors.department ? 'border-error-500' : ''}`}
                  {...register('department', { required: 'Department is required' })}
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && (
                  <p className="text-sm text-error-600 mt-1">{errors.department.message}</p>
                )}
              </div>
              
              <div className="form-control">
                <label htmlFor="startDate" className="form-label">Start Date</label>
                <input
                  id="startDate"
                  type="date"
                  className={`form-input ${errors.startDate ? 'border-error-500' : ''}`}
                  {...register('startDate', { required: 'Start date is required' })}
                />
                {errors.startDate && (
                  <p className="text-sm text-error-600 mt-1">{errors.startDate.message}</p>
                )}
              </div>
              
              <div className="form-control">
                <label htmlFor="endDate" className="form-label">End Date</label>
                <input
                  id="endDate"
                  type="date"
                  className={`form-input ${errors.endDate ? 'border-error-500' : ''}`}
                  {...register('endDate', { required: 'End date is required' })}
                />
                {errors.endDate && (
                  <p className="text-sm text-error-600 mt-1">{errors.endDate.message}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium text-neutral-700">Questions</h5>
                <button
                  type="button"
                  onClick={loadTemplateQuestions}
                  className="btn btn-outline flex items-center"
                >
                  <FileText size={18} className="mr-2" />
                  Load Template Questions
                </button>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start space-x-2 mb-4">
                  <div className="flex-grow">
                    <input
                      type="text"
                      className={`form-input ${errors.questions?.[index]?.text ? 'border-error-500' : ''}`}
                      placeholder={`Question ${index + 1}`}
                      {...register(`questions.${index}.text` as const, { required: 'Question text is required' })}
                    />
                    {errors.questions?.[index]?.text && (
                      <p className="text-sm text-error-600 mt-1">{errors.questions[index]?.text?.message}</p>
                    )}
                  </div>
                  
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="btn btn-outline btn-error p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => append({ text: '' })}
                className="btn btn-outline flex items-center"
              >
                <PlusCircle size={18} className="mr-2" />
                Add Question
              </button>
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? <LoadingSpinner size="sm" /> : 'Create Feedback Period'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-neutral-800 mb-4">
        Active Feedback Periods
      </h3>
      
      {feedbackPeriods.length === 0 ? (
        <div className="card p-8 text-center">
          <Clock size={48} className="mx-auto mb-4 text-neutral-300" />
          <h3 className="text-xl font-semibold text-neutral-700 mb-2">No Feedback Periods</h3>
          <p className="text-neutral-500">
            No feedback periods have been created yet. Create one using the form above.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {feedbackPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-neutral-800">{period.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar size={16} className="text-neutral-500 mr-2" />
                        <span className="text-neutral-800">
                          {format(period.startDate, 'MMM dd')} - {format(period.endDate, 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-neutral-800">{period.questions.length}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {period.active ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-success-50 text-success-600">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleActive(period.id, period.active)}
                          className={`px-3 py-1 text-xs font-medium rounded ${
                            period.active 
                              ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' 
                              : 'bg-success-50 hover:bg-success-100 text-success-600'
                          }`}
                        >
                          {period.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deletePeriod(period.id)}
                          className="px-3 py-1 text-xs font-medium rounded bg-error-50 hover:bg-error-100 text-error-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackQuestionManager;