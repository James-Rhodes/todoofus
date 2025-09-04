const todoTemplate = document.getElementById("todo-template");
const todoFormTemplate = document.getElementById("todo-form-template");

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

async function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  let parentId = parseInt(
    submittedForm.querySelector("input[name='parent_id']").value,
  );
  parentId = isNaN(parentId) ? undefined : parentId; // If the value is empty then set it to undefined

  const newTodo = document.createElement("ul");
  const listItem = document.createElement("li");

  listItem.appendChild(todoTemplate.content.cloneNode(true));
  const todoDescription = submittedForm.querySelector(
    ".todo-description-input",
  ).value;
  newTodo.appendChild(listItem);

  newTodo.querySelector(".todo-description").textContent = todoDescription;

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
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  console.log("NEW TODO WITH ID: ", newTodoId);
  newTodo.querySelector("input[name='id']").value = newTodoId;
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
// TODO: Server should show all todo's from the last X days. Even if they are completed. So they can be unticked as necessary
