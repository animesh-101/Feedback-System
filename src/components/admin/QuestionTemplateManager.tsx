import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { addDoc, collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Department, departments } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { PlusCircle, Trash2, Save, AlertTriangle, FileText, Edit2 } from 'lucide-react';

interface QuestionTemplate {
  id: string;
  department: Department;
  questions: string[];
}

interface TemplateFormData {
  department: Department;
  questions: {
    text: string;
  }[];
}

const QuestionTemplateManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuestionTemplate | null>(null);

  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<TemplateFormData>({
    defaultValues: {
      department: departments[0],
      questions: [{ text: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'questions'
  });

  // Fetch existing templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const templatesRef = collection(db, 'questionTemplates');
        const templatesSnapshot = await getDocs(templatesRef);
        
        const templatesList: QuestionTemplate[] = [];
        templatesSnapshot.forEach((doc) => {
          const data = doc.data();
          templatesList.push({
            id: doc.id,
            department: data.department,
            questions: data.questions
          });
        });
        
        setTemplates(templatesList);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setError('Failed to load question templates');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTemplates();
  }, []);

  const onSubmit = async (data: TemplateFormData) => {
    if (data.questions.some(q => !q.text.trim())) {
      setError('All questions must have text');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const questions = data.questions.map(q => q.text.trim());
      
      if (editingTemplate) {
        // Update existing template
        await updateDoc(doc(db, 'questionTemplates', editingTemplate.id), {
          department: data.department,
          questions
        });
        
        setTemplates(prev => prev.map(t => 
          t.id === editingTemplate.id 
            ? { ...t, department: data.department, questions } 
            : t
        ));
        
        setSuccess('Template updated successfully');
      } else {
        // Create new template
        const docRef = await addDoc(collection(db, 'questionTemplates'), {
          department: data.department,
          questions
        });
        
        setTemplates(prev => [...prev, {
          id: docRef.id,
          department: data.department,
          questions
        }]);
        
        setSuccess('Template created successfully');
      }
      
      // Reset form
      reset({
        department: departments[0],
        questions: [{ text: '' }]
      });
      setEditingTemplate(null);
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (template: QuestionTemplate) => {
    setEditingTemplate(template);
    setValue('department', template.department);
    setValue('questions', template.questions.map(text => ({ text })));
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'questionTemplates', templateId));
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setSuccess('Template deleted successfully');
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Failed to delete template');
    }
  };

  const handleCancel = () => {
    setEditingTemplate(null);
    reset({
      department: departments[0],
      questions: [{ text: '' }]
    });
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
        Manage Question Templates
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
          <h4 className="font-medium text-neutral-800">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h4>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-6">
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
            </div>
            
            <div className="mb-6">
              <h5 className="font-medium text-neutral-700 mb-4">Questions</h5>
              
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
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => append({ text: '' })}
                  className="btn btn-outline flex items-center"
                >
                  <PlusCircle size={18} className="mr-2" />
                  Add Question
                </button>
                
                {editingTemplate && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                )}
              </div>
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? <LoadingSpinner size="sm" /> : editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-neutral-800 mb-4">
        Existing Templates
      </h3>
      
      {templates.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText size={48} className="mx-auto mb-4 text-neutral-300" />
          <h3 className="text-xl font-semibold text-neutral-700 mb-2">No Templates</h3>
          <p className="text-neutral-500">
            No question templates have been created yet. Create one using the form above.
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
                    Questions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-neutral-800">{template.department}</div>
                    </td>
                    <td className="px-6 py-4">
                      <ul className="list-disc list-inside space-y-1">
                        {template.questions.map((question, index) => (
                          <li key={index} className="text-sm text-neutral-600">{question}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="btn btn-outline btn-sm flex items-center"
                        >
                          <Edit2 size={16} className="mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="btn btn-outline btn-error btn-sm flex items-center"
                        >
                          <Trash2 size={16} className="mr-1" />
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

export default QuestionTemplateManager; 