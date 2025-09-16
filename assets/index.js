const todoTemplate = document.getElementById("todo-template");
const todoFormTemplate = document.getElementById("todo-form-template");

window.addEventListener("load", async (event) => {
  let todos;
  try {
    const response = await fetch("/todos");
    todos = await response.json();
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const todo_container = document.getElementById("all-todos");
  for (todo of todos) {
    const todoElement = createTodoElement(
      todo.id,
      todo.description,
      todo.children,
    );

    todo_container.appendChild(todoElement);
  }
});

// Places the form immediately after the refNode
function newTodoForm(refNode) {
  let parentId = "";
  if (refNode.id != "dummy-first-todo") {
    parentId = refNode.querySelector("input[name='id']").value;
  }

  const template = todoFormTemplate.content.cloneNode(true);
  template.querySelector("input[name='parent_id']").value = parentId;
  refNode.after(template);
}

function removeTodoForm(formElement) {
  formElement.remove();
}

function createTodoElement(id, todoDescription, childTodos) {
  const newTodo = document.createElement("ul");

  const listItem = document.createElement("li");
  listItem.appendChild(todoTemplate.content.cloneNode(true));
  newTodo.appendChild(listItem);

  newTodo.querySelector(".todo-description").textContent = todoDescription;

  newTodo.querySelector("input[name='id']").value = id;

  for (child of childTodos) {
    newTodo.appendChild(
      createTodoElement(child.id, child.description, child.children),
    );
  }

  return newTodo;
}

async function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  let parentId = parseInt(
    submittedForm.querySelector("input[name='parent_id']").value,
  );
  parentId = isNaN(parentId) ? undefined : parentId; // If the value is empty then set it to undefined

  const todoDescription = submittedForm.querySelector(
    ".todo-description-input",
  ).value;

  let newTodoId = undefined;
  try {
    const response = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: todoDescription,
        parentId: parentId,
      }),
    });

    const json_resp = await response.json();
    newTodoId = json_resp.id;
    console.log("Created new Todo with ID: ", newTodoId);
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const newTodo = createTodoElement(newTodoId, todoDescription, []);
  submittedForm.closest(".todo-form").replaceWith(newTodo);
}

function getChildrenTodoItems(parentTodo) {
  const parentUL = parentTodo.parentElement.parentElement; // The todo item is in a li, which must also be in a ul
  return parentUL.querySelectorAll(".todo-item");
}

// TODO: On check of a todo, recursively check all of its children todos
// TODO: On uncheck of a todo, recursively uncheck all of its children todos
function toggleTodoItemRecursively(parentTodo) {
  const checked = parentTodo.querySelector(".todo-checkbox").checked;
  const childTodos = getChildrenTodoItems(parentTodo);

  // TODO: Actually send this to the DB
  for (const child of childTodos) {
    child.querySelector(".todo-checkbox").checked = checked;
  }
}

// TODO: checked nodes sorted to the bottom of the ul they are in, when unchecked move them back into the unchecked section
